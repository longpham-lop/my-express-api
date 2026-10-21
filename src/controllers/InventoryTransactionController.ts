
import { Request, Response } from "express";
import { WhereOptions } from "sequelize";

import InventoryTransaction from "../models/InventoryTransaction";
import Branch from "../models/Branch";
import Ingredient from "../models/Ingredient";
import User from "../models/User";
import { Transaction } from "sequelize";
import sequelize from "../config/db";
import BranchInventory from "../models/BranchInventory";

import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];

const VALID_TYPES = ["import", "export", "adjustment"];

const getAllInventoryTransactions = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const whereCondition: WhereOptions = {};

    // 1. Phân quyền và giới hạn chi nhánh
    if (GLOBAL_ROLES.includes(req.user.role)) {
      const branchQuery = req.query.branch_id;

      if (branchQuery !== undefined) {
        const branchId = Number(branchQuery);

        if (!Number.isInteger(branchId) || branchId <= 0) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        whereCondition.branch_id = branchId;
      }
    } else {
      const branchId = req.user.branchId;

      if (!branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      // Không cho phép query ghi đè chi nhánh được cấp quyền
      whereCondition.branch_id = branchId;
    }

    // 2. Lọc theo loại giao dịch
    const typeQuery = req.query.type;

    if (typeQuery !== undefined) {
      if (
        typeof typeQuery !== "string" ||
        !VALID_TYPES.includes(typeQuery)
      ) {
        return res.status(400).json({
          message: "Loại giao dịch không hợp lệ",
        });
      }

      whereCondition.type = typeQuery;
    }

    // 3. Lọc theo nguyên liệu
    const ingredientQuery = req.query.ingredient_id;

    if (ingredientQuery !== undefined) {
      const ingredientId = Number(ingredientQuery);

      if (
        !Number.isInteger(ingredientId) ||
        ingredientId <= 0
      ) {
        return res.status(400).json({
          message: "ingredient_id không hợp lệ",
        });
      }

      whereCondition.ingredient_id = ingredientId;
    }

    // 4. Phân trang
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "page hoặc limit không hợp lệ",
      });
    }

    const offset = (page - 1) * limit;

    // 5. Lấy dữ liệu và tổng số bản ghi
    const { count, rows } =
      await InventoryTransaction.findAndCountAll({
        where: whereCondition,

        include: [
          {
            model: Branch,
            as: "branch",
          },
          {
            model: Ingredient,
            as: "ingredient",
          },
          {
            model: User,
            as: "creator",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],

        order: [["id", "DESC"]],
        limit,
        offset,
      });

    return res.json({
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error(
      "GET INVENTORY TRANSACTIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy lịch sử giao dịch kho",
    });
  }
};

const getInventoryTransactionById = async (
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

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Transaction id không hợp lệ",
      });
    }

    const transaction =
      await InventoryTransaction.findByPk(id, {
        include: [
          {
            model: Branch,
            as: "branch",
          },
          {
            model: Ingredient,
            as: "ingredient",
          },
          {
            model: User,
            as: "creator",
            attributes: ["id", "name", "email"],
            required: false,
          },
        ],
      });

    if (!transaction) {
      return res.status(404).json({
        message: "Không tìm thấy giao dịch kho",
      });
    }

    // Giới hạn giao dịch theo chi nhánh
    if (!GLOBAL_ROLES.includes(req.user.role)) {
      const branchId = req.user.branchId;

      if (
        !branchId ||
        transaction.branch_id !== branchId
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xem giao dịch của chi nhánh khác",
        });
      }
    }

    return res.json(transaction);
  } catch (error) {
    console.error(
      "GET INVENTORY TRANSACTION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy giao dịch kho",
    });
  }
};
  
const adjustInventory = async (
  req: AuthRequest,
  res: Response
) => {
  const transaction = await sequelize.transaction();

  try {
    if (!req.user) {
      await transaction.rollback();
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const allowedRoles = [
      "admin",
      "chain_manager",
      "branch_manager",
    ];

    if (!allowedRoles.includes(req.user.role)) {
      await transaction.rollback();
      return res.status(403).json({
        message: "Bạn không có quyền điều chỉnh kho",
      });
    }

    const ingredientId = Number(req.body.ingredient_id);
    const adjustment = Number(req.body.quantity);
    const note = req.body.note;

    if (
      !Number.isInteger(ingredientId) ||
      ingredientId <= 0
    ) {
      await transaction.rollback();
      return res.status(400).json({
        message: "ingredient_id không hợp lệ",
      });
    }

    if (
      req.body.quantity === null ||
      req.body.quantity === undefined ||
      req.body.quantity === "" ||
      !Number.isFinite(adjustment) ||
      adjustment === 0 ||
      Math.abs(adjustment) > 1_000_000_000 ||
      Math.round(adjustment * 1000) / 1000 !== adjustment
    ) {
      await transaction.rollback();
      return res.status(400).json({
        message:
          "quantity phải khác 0, tối đa 3 chữ số thập phân và nằm trong giới hạn cho phép",
      });
    }

    if (
      typeof note !== "string" ||
      note.trim().length < 3 ||
      note.trim().length > 1000
    ) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Lý do điều chỉnh phải từ 3 đến 1000 ký tự",
      });
    }

    let branchId: number;

    if (
      req.user.role === "admin" ||
      req.user.role === "chain_manager"
    ) {
      branchId = Number(req.body.branch_id);

      if (!Number.isInteger(branchId) || branchId <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          message: "branch_id không hợp lệ",
        });
      }
    } else {
      branchId = Number(req.user.branchId);

      if (!Number.isInteger(branchId) || branchId <= 0) {
        await transaction.rollback();
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }
    }

    const branch = await Branch.findByPk(branchId, {
      transaction,
    });

    if (!branch) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    const ingredient = await Ingredient.findByPk(
      ingredientId,
      { transaction }
    );

    if (!ingredient) {
      await transaction.rollback();
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu",
      });
    }

    if (ingredient.status !== "active") {
      await transaction.rollback();
      return res.status(400).json({
        message: "Không thể điều chỉnh nguyên liệu đã ngừng hoạt động",
      });
    }

    const inventory = await BranchInventory.findOne({
      where: {
        branch_id: branchId,
        ingredient_id: ingredientId,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    const currentQuantity = inventory
      ? Number(inventory.quantity)
      : 0;

    if (
      !Number.isFinite(currentQuantity) ||
      currentQuantity < 0
    ) {
      await transaction.rollback();
      return res.status(409).json({
        message: "Số dư tồn kho hiện tại không hợp lệ",
      });
    }

    const newQuantity =
      Math.round((currentQuantity + adjustment) * 1000) / 1000;

    if (newQuantity < 0) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Không thể điều chỉnh khiến tồn kho âm",
        current_quantity: currentQuantity,
        adjustment_quantity: adjustment,
      });
    }

    if (newQuantity > 1_000_000_000) {
      await transaction.rollback();
      return res.status(400).json({
        message: "Tồn kho sau điều chỉnh vượt giới hạn cho phép",
      });
    }

    if (inventory) {
      await inventory.update(
        { quantity: newQuantity },
        { transaction }
      );
    } else {
      await BranchInventory.create(
        {
          branch_id: branchId,
          ingredient_id: ingredientId,
          quantity: newQuantity,
          minimum_stock: 0,
        },
        { transaction }
      );
    }

    const inventoryTransaction =
      await InventoryTransaction.create(
        {
          branch_id: branchId,
          ingredient_id: ingredientId,
          type: "adjustment",
          quantity: adjustment,
          unit: ingredient.unit,
          reference_type: "manual_adjustment",
          reference_id: null,
          note: note.trim(),
          created_by: req.user.id,
        },
        { transaction }
      );

    await transaction.commit();

    return res.status(201).json({
      message: "Điều chỉnh tồn kho thành công",
      data: {
        transaction_id: inventoryTransaction.id,
        branch_id: branchId,
        ingredient_id: ingredientId,
        ingredient_name: ingredient.name,
        unit: ingredient.unit,
        previous_quantity: currentQuantity,
        adjustment_quantity: adjustment,
        new_quantity: newQuantity,
        note: note.trim(),
      },
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error(
        "ROLLBACK INVENTORY ADJUSTMENT ERROR:",
        rollbackError
      );
    }

    console.error("ADJUST INVENTORY ERROR:", error);

    return res.status(500).json({
      message: "Không thể điều chỉnh tồn kho",
    });
  }
};


export {
  getAllInventoryTransactions,
  getInventoryTransactionById,
  adjustInventory,
};
