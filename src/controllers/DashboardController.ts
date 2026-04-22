import { Request, Response } from "express";
import { fn, col, literal } from "sequelize";

import Menu from "../models/Menu";
import Order from "../models/Order";
import Table from "../models/Table";
import Reservation from "../models/Reservation";
import OrderItem from "../models/OrderItem";

export const getDashboard = async (req: Request, res: Response) => {
  try {
    /* ===== CARD STATS ===== */
    const [menuCount, orderCount, tableAvailable, pendingOrders] =
      await Promise.all([
        Menu.count(),

        Order.count(),

        Table.count({
          where: {
            status: "available",
          },
        }),

        Order.count({
          where: {
            status: "pending",
          },
        }),
      ]);

    /* ===== TABLE STATUS ===== */
    const [availableTables, reservedTables, occupiedTables] =
      await Promise.all([
        Table.count({
          where: {
            status: "available",
          },
        }),

        Table.count({
          where: {
            status: "reserved",
          },
        }),

        Table.count({
          where: {
            status: "occupied",
          },
        }),
      ]);

    /* ===== BOOKING BY DAY ===== */
    const bookingRows = await Reservation.findAll({
      attributes: [
        [fn("DATE", col("reservation_time")), "day"],
        [fn("COUNT", col("id")), "bookings"],
      ],
      group: [fn("DATE", col("reservation_time"))],
      order: [[literal("day"), "ASC"]],
      raw: true,
    });

    const bookingByDay = bookingRows.map((row: any) => ({
      day: row.day,
      bookings: Number(row.bookings),
    }));

    /* ===== RECENT ORDERS ===== */
    const recentOrders = await Order.findAll({
      attributes: [
        "id",
        "status",
        "total_price",
        "createdAt",
      ],
      order: [["createdAt", "DESC"]],
      limit: 5,
      raw: true,
    });
    /* ===== TOP MÓN ĐƯỢC GỌI NHIỀU ===== */

    const topDishRows = await OrderItem.findAll({
      attributes: [
        "menu_item_id",
        [fn("SUM", col("quantity")), "totalSold"],
      ],
      group: ["menu_item_id"],
      order: [[fn("SUM", col("quantity")), "DESC"]],
      limit: 5,
      raw: true,
    });

    const topDishes = await Promise.all(
      topDishRows.map(async (item: any) => {
        const menu = await Menu.findByPk(item.menu_item_id);

        return {
          name: menu?.name || "Không xác định",
          value: Number(item.totalSold || 0),
        };
      })
    );
    /* ===== RESPONSE ===== */
    res.json({
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
  } catch (err: any) {
    console.log("Dashboard Error:", err);

    res.status(500).json({
      message: "Lỗi server dashboard",
      error: err.message,
    });
  }
};