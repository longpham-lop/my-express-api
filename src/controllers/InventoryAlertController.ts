
import { Request, Response } from "express";
import { Op } from "sequelize";

import sequelize from "../config/db";
import BranchInventory from "../models/BranchInventory";
import Branch from "../models/Branch";
import Ingredient from "../models/Ingredient";
import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];

const getLowStockInventory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const whereCondition: Record<string, unknown> = {};

    // Admin và quản lý chuỗi có thể lọc theo chi nhánh.
    if (GLOBAL_ROLES.includes(req.user.role)) {
      if (req.query.branch_id !== undefined) {
        const branchId = Number(req.query.branch_id);

        if (!Number.isInteger(branchId) || branchId <= 0) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        whereCondition.branch_id = branchId;
      }
    } else {
      // Các vai trò còn lại chỉ xem kho chi nhánh của mình.
      const branchId = Number(req.user.branchId);

      if (!Number.isInteger(branchId) || branchId <= 0) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      whereCondition.branch_id = branchId;
    }

    const lowStockItems = await BranchInventory.findAll({
      where: {
        ...whereCondition,
        [Op.and]: [
          sequelize.where(
            sequelize.col("BranchInventory.quantity"),
            Op.lte,
            sequelize.col("BranchInventory.minimum_stock")
          ),
        ],
      },
      include: [
        {
          model: Branch,
          as: "branch",
          required: true,
        },
        {
          model: Ingredient,
          as: "ingredient",
          required: true,
          where: {
            status: "active",
          },
        },
      ],
      order: [
        ["branch_id", "ASC"],
        ["ingredient_id", "ASC"],
      ],
    });

    return res.status(200).json({
      message: "Lấy danh sách nguyên liệu tồn kho thấp thành công",
      data: lowStockItems,
      total: lowStockItems.length,
    });
  } catch (error) {
    console.error("GET LOW STOCK INVENTORY ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách nguyên liệu tồn kho thấp",
    });
  }
};

export { getLowStockInventory };
