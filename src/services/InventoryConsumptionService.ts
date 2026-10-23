import { Transaction } from "sequelize";

import RecipeItem from "../models/RecipeItem";
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

export class InventoryConsumptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryConsumptionError";
  }
}

/**
 * Xuất kho nguyên liệu khi một OrderItem được chuyển sang "served".
 *
 * Công thức:
 *
 * nguyên liệu cần dùng =
 * recipe.quantity × orderItem.quantity
 *
 * Ví dụ:
 *
 * Phở bò x 2
 * Thịt bò = 0.1kg / món
 *
 * => xuất 0.2kg
 */
export const consumeInventoryForOrderItem = async (
  params: ConsumeOrderItemParams,
  transaction: Transaction
) => {
  const {
    orderItemId,
    orderId,
    branchId,
    menuItemId,
    orderItemQuantity,
    createdBy,
  } = params;

  // =====================================================
  // 1. KIỂM TRA QUANTITY
  // =====================================================

  if (
    !Number.isFinite(orderItemQuantity) ||
    orderItemQuantity <= 0
  ) {
    throw new InventoryConsumptionError(
      "Số lượng món không hợp lệ"
    );
  }

  // =====================================================
  // 2. CHỐNG TRỪ KHO 2 LẦN
  // =====================================================

  const existedTransaction =
    await InventoryTransaction.findOne({
      where: {
        reference_type: "order_item",
        reference_id: orderItemId,
        type: "export",
      },
      transaction,
    });

  if (existedTransaction) {
    throw new InventoryConsumptionError(
      `OrderItem #${orderItemId} đã được xuất kho trước đó`
    );
  }

  // =====================================================
  // 3. LẤY CÔNG THỨC
  // =====================================================

  const recipes = await RecipeItem.findAll({
    where: {
      menu_item_id: menuItemId,
    },
    order: [["ingredient_id", "ASC"]],
    transaction,
  });

  // =====================================================
  // 4. MÓN CHƯA CÓ CÔNG THỨC
  // =====================================================

  if (recipes.length === 0) {
    throw new InventoryConsumptionError(
      `Món #${menuItemId} chưa có công thức nguyên liệu. Không thể xuất kho.`
    );
  }

  // =====================================================
  // 5. TÍNH NGUYÊN LIỆU CẦN XUẤT
  // =====================================================

  const requirements = recipes.map((recipe) => {
    const requiredQuantity =
      Number(recipe.quantity) *
      orderItemQuantity;

    return {
      ingredientId: recipe.ingredient_id,
      quantity: requiredQuantity,
      unit: recipe.unit,
    };
  });

  // =====================================================
  // 6. LẤY TỒN KHO
  // =====================================================

  const inventories = [];

  for (const requirement of requirements) {
    const inventory =
      await BranchInventory.findOne({
        where: {
          branch_id: branchId,
          ingredient_id:
            requirement.ingredientId,
        },

        transaction,

        // Khóa dòng tồn kho
        // để tránh 2 request cùng trừ một lúc
        lock: transaction.LOCK.UPDATE,
      });

    if (!inventory) {
      throw new InventoryConsumptionError(
        `Chi nhánh chưa có tồn kho cho nguyên liệu #${requirement.ingredientId}`
      );
    }

    inventories.push({
      inventory,
      requirement,
    });
    
  // Kiểm tra lại sau khi đã khóa các dòng tồn kho.
  // Nếu request khác vừa xuất kho và commit,
  // request hiện tại sẽ phát hiện giao dịch đã tồn tại.

    const duplicateTransactions =
      await InventoryTransaction.findOne({
        where: {
          reference_type: "order_item",
          reference_id: orderItemId,
          type: "export",
        },
        transaction,
      });

    if (duplicateTransactions) {
      throw new InventoryConsumptionError(
        `OrderItem #${orderItemId} đã được xuất kho trước đó`
      );
    }
  }

  // =====================================================
  // 7. KIỂM TRA ĐỦ TỒN KHO TRƯỚC KHI TRỪ
  // =====================================================

  for (const item of inventories) {
    const currentQuantity =
      Number(item.inventory.quantity);

    const requiredQuantity =
      item.requirement.quantity;

    if (
      currentQuantity < requiredQuantity
    ) {
      throw new InventoryConsumptionError(
        `Không đủ tồn kho nguyên liệu #${item.requirement.ingredientId}. ` +
        `Hiện có ${currentQuantity} ${item.requirement.unit}, ` +
        `cần ${requiredQuantity} ${item.requirement.unit}`
      );
    }
  }

  // =====================================================
  // 8. TRỪ TỒN KHO + GHI LỊCH SỬ
  // =====================================================

  for (const item of inventories) {
    const currentQuantity =
      Number(item.inventory.quantity);

    const exportQuantity =
      item.requirement.quantity;

    const newQuantity =
      currentQuantity - exportQuantity;

    // ---------------------------------------------------
    // UPDATE BRANCH INVENTORY
    // ---------------------------------------------------

    await item.inventory.update(
      {
        quantity: newQuantity,
      },
      {
        transaction,
      }
    );

    // ---------------------------------------------------
    // CREATE INVENTORY TRANSACTION
    // ---------------------------------------------------

    await InventoryTransaction.create(
      {
        branch_id: branchId,

        ingredient_id:
          item.requirement.ingredientId,

        type: "export",

        // Xuất kho ghi số âm
        quantity: -exportQuantity,

        unit: item.requirement.unit,

        reference_type: "order_item",

        reference_id: orderItemId,

        note:
          `Xuất kho cho Order #${orderId}, ` +
          `OrderItem #${orderItemId}`,

        created_by: createdBy,
      },
      {
        transaction,
      }
    );
  }

  // =====================================================
  // 9. RETURN RESULT
  // =====================================================

  return {
    orderItemId,

    orderId,

    branchId,

    menuItemId,

    exportedItems: requirements,
  };
};