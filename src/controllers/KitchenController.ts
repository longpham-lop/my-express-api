import { Response } from "express";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import MenuItem from "../models/Menu";
import { AuthRequest } from "../middlewares/auth.middleware";
import { Op } from "sequelize";

export const getKitchenOrders = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const allowedRoles = [
      "admin",
      "chain_manager",
      "branch_manager",
      "kitchen",
    ];

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền truy cập màn hình bếp",
      });
    }

    const whereCondition: Record<string, unknown> = {
      status: { [Op.in]: ["pending", "processing"] },
      is_deleted: false,
    };

    if (
      req.user.role !== "admin" &&
      req.user.role !== "chain_manager"
    ) {
      if (req.user.branchId === null) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      whereCondition.branch_id = req.user.branchId;
    }

    const orders = await Order.findAll({
      where: whereCondition,
      include: [
        {
          model: OrderItem,
          as: "items",
          where: {
            status: ["pending", "cooking"],
          },
          required: true,
          include: [
            {
              model: MenuItem,
              as: "menu",
            },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return res.status(200).json(orders);
  } catch (error) {
    console.error("GET KITCHEN ORDERS ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách đơn bếp",
    });
  }
};