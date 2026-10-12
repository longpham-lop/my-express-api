import { Response } from "express";
import { Transaction } from "sequelize";

import sequelize from "../config/db";
import Purchase from "../models/Purchase";
import PurchaseItem from "../models/PurchaseItem";
import Branch from "../models/Branch";
import Ingredient from "../models/Ingredient";
import BranchInventory from "../models/BranchInventory";
import InventoryTransaction from "../models/InventoryTransaction";

import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];

const MANAGE_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const VIEW_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
  "kitchen",
  "cashier",
];

const canAccessBranch = (
  req: AuthRequest,
  branchId: number
) => {
  if (!req.user) {
    return false;
  }

  if (GLOBAL_ROLES.includes(req.user.role)) {
    return true;
  }

  return req.user.branchId === branchId;
};

const canManage = (req: AuthRequest) => {
  return !! req.user &&
    MANAGE_ROLES.includes(req.user.role)
};

/* =====================================================
   GET ALL PURCHASES
===================================================== */

export const getAllPurchases = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const branchQuery = req.query.branch_id;

    const whereCondition: {
      branch_id?: number;
    } = {};

    if (GLOBAL_ROLES.includes(req.user.role)) {
      if (branchQuery !== undefined) {
        const branchId = Number(branchQuery);

        if (!Number.isInteger(branchId)) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        whereCondition.branch_id = branchId;
      }
    } else {
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      whereCondition.branch_id = req.user.branchId;
    }

    const purchases = await Purchase.findAll({
      where: whereCondition,
      include: [
        {
          model: Branch,
          as: "branch",
        },
        {
          model: PurchaseItem,
          as: "items",
          include: [
            {
              model: Ingredient,
              as: "ingredient",
            },
          ],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.json(purchases);
  } catch (error) {
    console.error("GET PURCHASES ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách phiếu nhập",
    });
  }
};

/* =====================================================
   GET PURCHASE BY ID
===================================================== */

export const getPurchaseById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Purchase id không hợp lệ",
      });
    }

    const purchase = await Purchase.findByPk(id, {
      include: [
        {
          model: Branch,
          as: "branch",
        },
        {
          model: PurchaseItem,
          as: "items",
          include: [
            {
              model: Ingredient,
              as: "ingredient",
            },
          ],
        },
      ],
    });

    if (!purchase) {
      return res.status(404).json({
        message: "Không tìm thấy phiếu nhập",
      });
    }

    if (!canAccessBranch(req, purchase.branch_id)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem phiếu nhập của chi nhánh khác",
      });
    }

    return res.json(purchase);
  } catch (error) {
    console.error("GET PURCHASE BY ID ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy phiếu nhập",
    });
  }
};

/* =====================================================
   CREATE PURCHASE
===================================================== */

export const createPurchase = async (
  req: AuthRequest,
  res: Response
) => {
  const transaction: Transaction =
    await sequelize.transaction();

  try {
    if (!canManage(req)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền tạo phiếu nhập",
      });
    }

    const {
      branch_id,
      supplier_name,
      note,
      items,
    } = req.body;

    const branchId = Number(branch_id);

    if (!Number.isInteger(branchId)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "branch_id không hợp lệ",
      });
    }

    if (!canAccessBranch(req, branchId)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền thao tác tại chi nhánh này",
      });
    }

    const branch = await Branch.findByPk(
      branchId,
      { transaction }
    );

    if (!branch) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Phiếu nhập phải có ít nhất một nguyên liệu",
      });
    }

    let totalAmount = 0;

    const validatedItems = [];

    for (const item of items) {
      const ingredientId = Number(
        item.ingredient_id
      );

      const quantity = Number(item.quantity);
      const unitPrice = Number(
        item.unit_price ?? 0
      );

      const unit =
        typeof item.unit === "string"
          ? item.unit.trim()
          : "";

      if (!Number.isInteger(ingredientId)) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "ingredient_id không hợp lệ",
        });
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "quantity phải lớn hơn 0",
        });
      }

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "unit_price không hợp lệ",
        });
      }

      if (!unit) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "unit là bắt buộc",
        });
      }

      const ingredient =
        await Ingredient.findByPk(
          ingredientId,
          { transaction }
        );

      if (!ingredient) {
        await transaction.rollback();

        return res.status(404).json({
          message:
            `Không tìm thấy nguyên liệu ID ${ingredientId}`,
        });
      }

      if (ingredient.status !== "active") {
        await transaction.rollback();

        return res.status(400).json({
          message:
            `Nguyên liệu "${ingredient.name}" đang inactive`,
        });
      }

      const totalPrice =
        quantity * unitPrice;

      totalAmount += totalPrice;

      validatedItems.push({
        ingredient_id: ingredientId,
        quantity,
        unit,
        unit_price: unitPrice,
        total_price: totalPrice,
      });
    }

    const purchase = await Purchase.create(
      {
        branch_id: branchId,
        supplier_name:
          supplier_name?.trim() || null,
        total_amount: totalAmount,
        status: "draft",
        note: note?.trim() || null,
        created_by: req.user?.id ?? null,
      },
      { transaction }
    );

    await PurchaseItem.bulkCreate(
      validatedItems.map((item) => ({
        purchase_id: purchase.id,
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
      { transaction }
    );

    await transaction.commit();

    const result =
      await Purchase.findByPk(purchase.id, {
        include: [
          {
            model: Branch,
            as: "branch",
          },
          {
            model: PurchaseItem,
            as: "items",
            include: [
              {
                model: Ingredient,
                as: "ingredient",
              },
            ],
          },
        ],
      });

    return res.status(201).json({
      message: "Tạo phiếu nhập thành công",
      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("CREATE PURCHASE ERROR:", error);

    return res.status(500).json({
      message: "Không thể tạo phiếu nhập",
    });
  }
};

/* =====================================================
   UPDATE PURCHASE
===================================================== */

export const updatePurchase = async (
  req: AuthRequest,
  res: Response
) => {
  const transaction: Transaction =
    await sequelize.transaction();

  try {
    if (!canManage(req)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền sửa phiếu nhập",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Purchase id không hợp lệ",
      });
    }

    const purchase =
      await Purchase.findByPk(id, {
        transaction,
      });

    if (!purchase) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Không tìm thấy phiếu nhập",
      });
    }

    if (!canAccessBranch(req, purchase.branch_id)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền sửa phiếu nhập của chi nhánh khác",
      });
    }

    if (purchase.status !== "draft") {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Chỉ có thể sửa phiếu nhập đang ở trạng thái draft",
      });
    }

    const {
      supplier_name,
      note,
      items,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Phiếu nhập phải có ít nhất một nguyên liệu",
      });
    }

    let totalAmount = 0;

    const validatedItems = [];

    for (const item of items) {
      const ingredientId = Number(
        item.ingredient_id
      );

      const quantity = Number(item.quantity);
      const unitPrice = Number(
        item.unit_price ?? 0
      );

      const unit =
        typeof item.unit === "string"
          ? item.unit.trim()
          : "";

      if (
        !Number.isInteger(ingredientId) ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !unit ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "Thông tin nguyên liệu không hợp lệ",
        });
      }

      const ingredient =
        await Ingredient.findByPk(
          ingredientId,
          { transaction }
        );

      if (!ingredient) {
        await transaction.rollback();

        return res.status(404).json({
          message:
            `Không tìm thấy nguyên liệu ID ${ingredientId}`,
        });
      }

      if (ingredient.status !== "active") {
        await transaction.rollback();

        return res.status(400).json({
          message:
            `Nguyên liệu "${ingredient.name}" đang inactive`,
        });
      }

      const totalPrice =
        quantity * unitPrice;

      totalAmount += totalPrice;

      validatedItems.push({
        ingredient_id: ingredientId,
        quantity,
        unit,
        unit_price: unitPrice,
        total_price: totalPrice,
      });
    }

    await purchase.update(
      {
        supplier_name:
          supplier_name?.trim() || null,
        note: note?.trim() || null,
        total_amount: totalAmount,
      },
      { transaction }
    );

    await PurchaseItem.destroy({
      where: {
        purchase_id: purchase.id,
      },
      transaction,
    });

    await PurchaseItem.bulkCreate(
      validatedItems.map((item) => ({
        purchase_id: purchase.id,
        ingredient_id: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit,
        unit_price: item.unit_price,
        total_price: item.total_price,
      })),
      { transaction }
    );

    await transaction.commit();

    const result =
      await Purchase.findByPk(purchase.id, {
        include: [
          {
            model: Branch,
            as: "branch",
          },
          {
            model: PurchaseItem,
            as: "items",
            include: [
              {
                model: Ingredient,
                as: "ingredient",
              },
            ],
          },
        ],
      });

    return res.json({
      message: "Cập nhật phiếu nhập thành công",
      data: result,
    });
  } catch (error) {
    await transaction.rollback();

    console.error("UPDATE PURCHASE ERROR:", error);

    return res.status(500).json({
      message: "Không thể cập nhật phiếu nhập",
    });
  }
};

/* =====================================================
   CONFIRM PURCHASE
===================================================== */

export const confirmPurchase = async (
  req: AuthRequest,
  res: Response
) => {
  const transaction: Transaction =
    await sequelize.transaction();

  try {
    if (!canManage(req)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền xác nhận phiếu nhập",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Purchase id không hợp lệ",
      });
    }

    const purchase =
      await Purchase.findByPk(id, {
        include: [
          {
            model: PurchaseItem,
            as: "items",
          },
        ],
        transaction,
      });

    if (!purchase) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Không tìm thấy phiếu nhập",
      });
    }

    if (!canAccessBranch(req, purchase.branch_id)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền xác nhận phiếu nhập của chi nhánh khác",
      });
    }

    if (purchase.status !== "draft") {
      await transaction.rollback();

      return res.status(400).json({
        message:
          `Không thể xác nhận phiếu nhập đang ở trạng thái ${purchase.status}`,
      });
    }

    if (
      !purchase.items ||
      purchase.items.length === 0
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Phiếu nhập chưa có nguyên liệu",
      });
    }

   for (const item of purchase.items) {
    const importQuantity = Number(item.quantity);

    const inventory =
      await BranchInventory.findOne({
        where: {
          branch_id: purchase.branch_id,
          ingredient_id: item.ingredient_id,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

    if (inventory) {
      const currentQuantity =
        Number(inventory.quantity) || 0;

      await inventory.update(
        {
          quantity:
            currentQuantity + importQuantity,
        },
        { transaction }
      );
    } else {
      await BranchInventory.create(
        {
          branch_id: purchase.branch_id,
          ingredient_id: item.ingredient_id,
          quantity: importQuantity,
          minimum_stock: 0,
        },
        { transaction }
      );
    }

    // Ghi lịch sử giao dịch kho
    await InventoryTransaction.create(
      {
        branch_id: purchase.branch_id,

        ingredient_id: item.ingredient_id,

        type: "import",

        quantity: importQuantity,

        unit: item.unit,

        reference_type: "purchase",

        reference_id: purchase.id,

        note: `Nhập kho từ phiếu nhập #${purchase.id}`,

        created_by: req.user?.id ?? null,
      },
      { transaction }
    );
  }

      await purchase.update(
        {
          status: "confirmed",
        },
        { transaction }
      );

    await transaction.commit();

    return res.json({
      message:
        "Xác nhận phiếu nhập và cập nhật tồn kho thành công",
    });
  } catch (error) {
    await transaction.rollback();

    console.error(
      "CONFIRM PURCHASE ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể xác nhận phiếu nhập",
    });
  }
};

/* =====================================================
   CANCEL PURCHASE
===================================================== */

export const cancelPurchase = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!canManage(req)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền hủy phiếu nhập",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Purchase id không hợp lệ",
      });
    }

    const purchase =
      await Purchase.findByPk(id);

    if (!purchase) {
      return res.status(404).json({
        message: "Không tìm thấy phiếu nhập",
      });
    }

    if (!canAccessBranch(req, purchase.branch_id)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền hủy phiếu nhập của chi nhánh khác",
      });
    }

    if (purchase.status !== "draft") {
      return res.status(400).json({
        message:
          "Chỉ có thể hủy phiếu nhập đang ở trạng thái draft",
      });
    }

    await purchase.update({
      status: "cancelled",
    });

    return res.json({
      message: "Hủy phiếu nhập thành công",
      data: purchase,
    });
  } catch (error) {
    console.error(
      "CANCEL PURCHASE ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể hủy phiếu nhập",
    });
  }
};