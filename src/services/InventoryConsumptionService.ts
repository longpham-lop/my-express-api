
import { Transaction } from "sequelize";
import RecipeItem from "../models/RecipeItem";
import Ingredient from "../models/Ingredient";
import BranchInventory from "../models/BranchInventory";
import InventoryTransaction from "../models/InventoryTransaction";

interface ConsumeOrderItemParams {
  orderItemId: number;
  orderId: number;
  branchId: number;
  menuItemId: number;
  orderItemQuantity: number;
  createdBy: number;
}

interface IngredientRequirement {
  ingredientId: number;
  quantity: number;
  unit: string;
}

interface InventoryRequirement {
  inventory: BranchInventory;
  ingredientId: number;
  quantity: number;
  unit: string;
}

export class InventoryConsumptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryConsumptionError";
  }
}

const normalizeUnit = (unit: string): string =>
  unit.trim().toLocaleLowerCase("vi-VN");

const convertToIngredientUnit = (
  quantity: number,
  recipeUnit: string,
  ingredientUnit: string,
): number => {
  const from = normalizeUnit(recipeUnit);
  const to = normalizeUnit(ingredientUnit);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new InventoryConsumptionError(
      "Định lượng nguyên liệu trong công thức không hợp lệ.",
    );
  }

  if (from === to) {
    return quantity;
  }

  // Khối lượng: quy đổi về đơn vị chuẩn của Ingredient.
  if (from === "g" && to === "kg") {
    return quantity / 1000;
  }

  if (from === "kg" && to === "g") {
    return quantity * 1000;
  }

  // Thể tích: quy đổi về đơn vị chuẩn của Ingredient.
  if (from === "ml" && to === "lít") {
    return quantity / 1000;
  }

  if (from === "lít" && to === "ml") {
    return quantity * 1000;
  }

  throw new InventoryConsumptionError(
    `Không thể quy đổi đơn vị "${recipeUnit}" sang "${ingredientUnit}". ` +
      "Hãy kiểm tra đơn vị công thức và đơn vị nguyên liệu.",
  );
};

export const consumeInventoryForOrderItem = async (
  params: ConsumeOrderItemParams,
  transaction: Transaction,
) => {
  const {
    orderItemId,
    orderId,
    branchId,
    menuItemId,
    orderItemQuantity,
    createdBy,
  } = params;

  if (
    !Number.isInteger(orderItemId) ||
    orderItemId <= 0 ||
    !Number.isInteger(orderId) ||
    orderId <= 0 ||
    !Number.isInteger(branchId) ||
    branchId <= 0 ||
    !Number.isInteger(menuItemId) ||
    menuItemId <= 0 ||
    !Number.isInteger(createdBy) ||
    createdBy <= 0
  ) {
    throw new InventoryConsumptionError(
      "Thông tin món ăn, đơn hàng, chi nhánh hoặc người thực hiện không hợp lệ.",
    );
  }

  if (!Number.isFinite(orderItemQuantity) || orderItemQuantity <= 0) {
    throw new InventoryConsumptionError("Số lượng món không hợp lệ.");
  }

  // Ngăn xuất kho lặp cho cùng một order item.
  const existedTransaction = await InventoryTransaction.findOne({
    where: {
      reference_type: "order_item",
      reference_id: orderItemId,
      type: "export",
    },
    transaction,
  });

  if (existedTransaction) {
    throw new InventoryConsumptionError(
      "Món ăn này đã được ghi nhận xuất kho, không thể xuất lần nữa.",
    );
  }

  const recipes = await RecipeItem.findAll({
    where: { menu_item_id: menuItemId },
    order: [["ingredient_id", "ASC"]],
    transaction,
  });

  if (recipes.length === 0) {
    throw new InventoryConsumptionError(
      "Món ăn chưa có công thức nguyên liệu, không thể xuất kho.",
    );
  }

  // Lấy danh sách nguyên liệu chuẩn để xác định đơn vị tồn kho.
  const ingredientIds = [
    ...new Set(recipes.map((recipe) => Number(recipe.ingredient_id))),
  ];

  const ingredients = await Ingredient.findAll({
    where: { id: ingredientIds },
    transaction,
  });

  const ingredientMap = new Map<number, Ingredient>();

  for (const ingredient of ingredients) {
    ingredientMap.set(Number(ingredient.id), ingredient);
  }

  // Quy đổi từng dòng công thức sang đơn vị chuẩn của Ingredient,
  // sau đó cộng gộp nếu cùng nguyên liệu xuất hiện nhiều lần.
  const requirementMap = new Map<number, IngredientRequirement>();

  for (const recipe of recipes) {
    const ingredientId = Number(recipe.ingredient_id);
    const recipeQuantity = Number(recipe.quantity);
    const recipeUnit = String(recipe.unit).trim();
    const ingredient = ingredientMap.get(ingredientId);

    if (!ingredient) {
      throw new InventoryConsumptionError(
        `Không tìm thấy nguyên liệu ID ${ingredientId}.`,
      );
    }

    if (ingredient.status !== "active") {
      throw new InventoryConsumptionError(
        `Nguyên liệu "${ingredient.name}" đang ngừng hoạt động.`,
      );
    }

    const ingredientUnit = String(ingredient.unit).trim();

    const requiredQuantity =
      convertToIngredientUnit(
        recipeQuantity,
        recipeUnit,
        ingredientUnit,
      ) * orderItemQuantity;

    const existing = requirementMap.get(ingredientId);

    requirementMap.set(ingredientId, {
      ingredientId,
      quantity: (existing?.quantity ?? 0) + requiredQuantity,
      unit: ingredientUnit,
    });
  }

  const requirements = Array.from(requirementMap.values());

  // Khóa từng bản ghi tồn kho để tránh hai giao dịch đồng thời
  // cùng đọc một số lượng tồn cũ rồi trừ kho sai.
  const inventoryRequirements: InventoryRequirement[] = [];

  for (const requirement of requirements) {
    const inventory = await BranchInventory.findOne({
      where: {
        branch_id: branchId,
        ingredient_id: requirement.ingredientId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const ingredient = ingredientMap.get(requirement.ingredientId);

    if (!inventory || !ingredient) {
      throw new InventoryConsumptionError(
        `Chi nhánh chưa có tồn kho cho nguyên liệu ID ${requirement.ingredientId}.`,
      );
    }

    inventoryRequirements.push({
      inventory,
      ingredientId: requirement.ingredientId,
      quantity: requirement.quantity,
      unit: requirement.unit,
    });
  }

  // Kiểm tra toàn bộ tồn kho trước khi cập nhật bất kỳ nguyên liệu nào.
  for (const item of inventoryRequirements) {
    const currentQuantity = Number(item.inventory.quantity);

    if (!Number.isFinite(currentQuantity) || currentQuantity < 0) {
      throw new InventoryConsumptionError(
        `Số lượng tồn kho của nguyên liệu ID ${item.ingredientId} không hợp lệ.`,
      );
    }

    if (currentQuantity + 0.0000001 < item.quantity) {
      const ingredient = ingredientMap.get(item.ingredientId);

      throw new InventoryConsumptionError(
        `Không đủ "${ingredient?.name ?? `ID ${item.ingredientId}`}". ` +
          `Tồn kho: ${currentQuantity} ${item.unit}; ` +
          `cần: ${item.quantity} ${item.unit}.`,
      );
    }
  }

  // Trừ tồn và tạo giao dịch xuất kho trong cùng transaction.
  for (const item of inventoryRequirements) {
    const currentQuantity = Number(item.inventory.quantity);
    const remainingQuantity = Math.max(
      0,
      Number((currentQuantity - item.quantity).toFixed(3)),
    );

    await item.inventory.update(
      { quantity: remainingQuantity },
      { transaction },
    );

    await InventoryTransaction.create(
      {
        branch_id: branchId,
        ingredient_id: item.ingredientId,
        type: "export",
        quantity: -Number(item.quantity.toFixed(3)),
        unit: item.unit,
        reference_type: "order_item",
        reference_id: orderItemId,
        note: `Xuất kho cho đơn hàng #${orderId}, món #${orderItemId}`,
        created_by: createdBy,
      },
      { transaction },
    );
  }

  return {
    orderItemId,
    orderId,
    branchId,
    menuItemId,
    exportedItems: inventoryRequirements.map((item) => ({
      ingredientId: item.ingredientId,
      quantity: Number(item.quantity.toFixed(3)),
      unit: item.unit,
    })),
  };
};
