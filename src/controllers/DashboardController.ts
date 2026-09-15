import { Response } from "express";
import { fn, col, literal, Op, WhereOptions } from "sequelize";

import Menu from "../models/Menu";
import Order from "../models/Order";
import Table from "../models/Table";
import Reservation from "../models/Reservation";
import OrderItem from "../models/OrderItem";
import { AuthRequest } from "../middlewares/auth.middleware";

interface BookingRow {
  day: string;
  bookings: string | number;
}

interface TopDishRow {
  menu_item_id: number;
  totalSold: string | number;
}

export const getDashboard = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const isBranchManager = user.role === "branch_manager";

    if (isBranchManager && !user.branchId) {
      return res.status(403).json({
        message: "Tài khoản chưa được gán chi nhánh",
      });
    }

    const branchId = user.branchId;

    /*
     * =====================================================
     * FILTER THEO CHI NHÁNH
     * =====================================================
     */

    const menuWhere: WhereOptions =
      isBranchManager
        ? { branch_id: branchId }
        : {};

    const orderWhere: WhereOptions =
      isBranchManager
        ? { branch_id: branchId }
        : {};

    const tableWhere: WhereOptions =
      isBranchManager
        ? { branch_id: branchId }
        : {};

    const reservationWhere: WhereOptions =
      isBranchManager
        ? { branch_id: branchId }
        : {};

    /* =====================================================
     * CARD STATS
     * ===================================================== */

    const [
      menuCount,
      orderCount,
      tableAvailable,
      pendingOrders,
    ] = await Promise.all([
      Menu.count({
        where: menuWhere,
      }),

      Order.count({
        where: orderWhere,
      }),

      Table.count({
        where: {
          ...tableWhere,
          status: "available",
        },
      }),

      Order.count({
        where: {
          ...orderWhere,
          status: "pending",
        },
      }),
    ]);

    /* =====================================================
     * TABLE STATUS
     * ===================================================== */

    const [
      availableTables,
      reservedTables,
      occupiedTables,
    ] = await Promise.all([
      Table.count({
        where: {
          ...tableWhere,
          status: "available",
        },
      }),

      Table.count({
        where: {
          ...tableWhere,
          status: "reserved",
        },
      }),

      Table.count({
        where: {
          ...tableWhere,
          status: "occupied",
        },
      }),
    ]);

    /* =====================================================
     * BOOKING BY DAY
     * ===================================================== */

    const bookingRows = (await Reservation.findAll({
      attributes: [
        [fn("DATE", col("reservation_time")), "day"],
        [fn("COUNT", col("id")), "bookings"],
      ],
      where: reservationWhere,
      group: [fn("DATE", col("reservation_time"))],
      order: [[literal("day"), "ASC"]],
      raw: true,
    })) as unknown as BookingRow[];

    const bookingByDay = bookingRows.map((row) => ({
      day: row.day,
      bookings: Number(row.bookings),
    }));

    /* =====================================================
     * RECENT ORDERS
     * ===================================================== */

    const recentOrders = await Order.findAll({
      attributes: [
        "id",
        "status",
        "total_price",
        "createdAt",
      ],
      where: orderWhere,
      order: [["createdAt", "DESC"]],
      limit: 5,
      raw: true,
    });

    /* =====================================================
     * TOP MÓN
     * ===================================================== */

    let topDishRows: TopDishRow[] = [];

    if (isBranchManager) {
      /*
       * Lấy các order thuộc chi nhánh của branch_manager
       */
      const branchOrders = await Order.findAll({
        attributes: ["id"],
        where: {
          branch_id: branchId,
        },
        raw: true,
      });

      const orderIds = branchOrders.map((order) => order.id);

      if (orderIds.length > 0) {
        topDishRows = (await OrderItem.findAll({
          attributes: [
            "menu_item_id",
            [fn("SUM", col("quantity")), "totalSold"],
          ],
          where: {
            order_id: {
              [Op.in]: orderIds,
            },
          },
          group: ["menu_item_id"],
          order: [[fn("SUM", col("quantity")), "DESC"]],
          limit: 5,
          raw: true,
        })) as unknown as TopDishRow[];
      }
    } else {
      /*
       * Admin / chain_manager:
       * xem top món toàn hệ thống
       */
      topDishRows = (await OrderItem.findAll({
        attributes: [
          "menu_item_id",
          [fn("SUM", col("quantity")), "totalSold"],
        ],
        group: ["menu_item_id"],
        order: [[fn("SUM", col("quantity")), "DESC"]],
        limit: 5,
        raw: true,
      })) as unknown as TopDishRow[];
    }

    const topDishes = await Promise.all(
      topDishRows.map(async (item) => {
        const menu = await Menu.findByPk(item.menu_item_id);

        return {
          name: menu?.name || "Không xác định",
          value: Number(item.totalSold || 0),
        };
      })
    );

    /* =====================================================
     * RESPONSE
     * ===================================================== */

    return res.json({
      menu: menuCount,
      orders: orderCount,
      tables: tableAvailable,
      pendingOrders,

      bookingByDay,

      tableStatus: [
        {
          name: "Bàn trống",
          value: availableTables,
        },
        {
          name: "Đã đặt",
          value: reservedTables,
        },
        {
          name: "Đang phục vụ",
          value: occupiedTables,
        },
      ],

      topDishes,
      recentOrders,
    });
  } catch (err: unknown) {
    console.error("Dashboard Error:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";

    return res.status(500).json({
      message: "Lỗi server dashboard",
      error: message,
    });
  }
};