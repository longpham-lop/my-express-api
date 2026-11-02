import { Response } from "express";
import { Op, WhereOptions } from "sequelize";

import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import MenuItem from "../models/Menu";

import { AuthRequest } from "../middlewares/auth.middleware";

/* =====================================================
 * GET KITCHEN ORDERS
 * ===================================================== */

/**
 * GET /api/kitchen/orders
 *
 * Admin / Chain Manager:
 * - Xem đơn bếp toàn chuỗi.
 *
 * Branch Manager / Kitchen:
 * - Chỉ xem đơn bếp của chi nhánh mình.
 *
 * Trạng thái món hiển thị:
 * - pending
 * - cooking
 * - ready
 */
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

    if (
      !allowedRoles.includes(req.user.role)
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền truy cập màn hình bếp",
      });
    }

    const whereCondition: WhereOptions = {
      status: {
        [Op.in]: [
          "pending",
          "processing",
        ],
      },

      is_deleted: false,
    };

    /*
     * Nhân viên chi nhánh chỉ xem
     * dữ liệu của chi nhánh được phân công.
     */
    if (
      req.user.role !== "admin" &&
      req.user.role !== "chain_manager"
    ) {
      if (req.user.branchId == null) {
        return res.status(403).json({
          message:
            "Tài khoản chưa được gán chi nhánh",
        });
      }

      whereCondition.branch_id =
        Number(req.user.branchId);
    }

    const orders = await Order.findAll({
      where: whereCondition,

      include: [
        {
          model: OrderItem,
          as: "items",

          where: {
            status: {
              [Op.in]: [
                "pending",
                "cooking",
                "ready",
              ],
            },
          },

          required: true,

          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: [
                "id",
                "name",
                "price",
                "image",
              ],
              required: false,
            },
          ],
        },
      ],

      order: [
        ["createdAt", "ASC"],
      ],
    });

    return res.status(200).json(orders);
  } catch (error: unknown) {
    console.error(
      "GET KITCHEN ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể lấy danh sách đơn bếp",
    });
  }
};