
import { Request, Response } from "express";
import { WhereOptions } from "sequelize";

import InventoryTransaction from "../models/InventoryTransaction";
import Branch from "../models/Branch";
import Ingredient from "../models/Ingredient";
import User from "../models/User";

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

export {
  getAllInventoryTransactions,
  getInventoryTransactionById,
};
