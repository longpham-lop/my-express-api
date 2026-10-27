
import { Request, Response } from "express";
import { fn, col, Op, WhereOptions } from "sequelize";

import {
  Menu,
  Order,
  Table,
  Reservation,
  Payment,
  OrderItem,
  StaffBranch,
} from "../models";

import { AuthRequest } from "../middlewares/auth.middleware";

interface DashboardUser {
  id: number;
  role: string;
  branchId?: number | null;
}

interface PaymentAmountRow {
  amount: number | string;
}

interface BookingByDayRow {
  date: string;
  count: number | string;
}

interface TopDishRow {
  menu_item_id: number | string;
  totalSold: number | string;
}

interface MenuItemRow {
  id: number;
  name?: string;
}

const toNumber = (
  value: number | string | null | undefined
): number => Number(value ?? 0);

export const getDashboard = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  try {
    const authReq = req as AuthRequest;
    const user = authReq.user as DashboardUser | undefined;

    if (!user) {
      return res.status(401).json({
        message: "Vui lòng đăng nhập để xem Dashboard",
      });
    }

    const isAdmin = user.role === "admin";
    const isChainManager = user.role === "chain_manager";
    const isBranchManager = user.role === "branch_manager";

    if (!isAdmin && !isChainManager && !isBranchManager) {
      return res.status(403).json({
        message: "Bạn không có quyền xem Dashboard",
      });
    }

    // 1. Xác định các chi nhánh tài khoản được phép xem.
    let branchIds: number[] | null = null;

    if (isBranchManager) {
      if (!user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      branchIds = [Number(user.branchId)];
    }

    if (isChainManager) {
      const assignedBranches = await StaffBranch.findAll({
        attributes: ["branch_id"],
        where: {
          user_id: user.id,
        },
        raw: true,
      });

      branchIds = [
        ...new Set(
          assignedBranches.map((item) => Number(item.branch_id))
        ),
      ];

      if (branchIds.length === 0) {
        return res.status(403).json({
          message: "Tài khoản chưa được phân công chi nhánh quản lý",
        });
      }
    }

    // 2. Tạo điều kiện lọc theo chi nhánh.
    // Admin có branchIds = null nên được xem toàn hệ thống.
    const branchFilter: WhereOptions = branchIds
      ? {
          branch_id: {
            [Op.in]: branchIds,
          },
        }
      : {};

    const menuWhere: WhereOptions = {
      ...branchFilter,
    };

    const orderWhere: WhereOptions = {
      is_deleted: false,
      ...branchFilter,
    };

    const tableWhere: WhereOptions = {
      ...branchFilter,
    };

    const reservationWhere: WhereOptions = {
      ...branchFilter,
    };

    // 3. Thống kê tổng quan.
    const [
      menuCount,
      orderCount,
      availableTableCount,
      pendingOrderCount,
      bookingCount,
      successfulPayments,
      reservedTableCount,
      occupiedTableCount,
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

      Reservation.count({
        where: reservationWhere,
      }),

      Payment.findAll({
        attributes: ["amount"],
        where: {
          status: "success",
        },
        include: [
          {
            model: Order,
            attributes: [],
            where: {
              ...orderWhere,
              status: {
                [Op.ne]: "cancelled",
              },
            },
            required: true,
          },
        ],
        raw: true,
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

    // 4. Doanh thu từ các khoản thanh toán thành công
    // của đơn chưa bị xóa mềm hoặc hủy.
    const paymentRows =
      successfulPayments as unknown as PaymentAmountRow[];

    const revenue = paymentRows.reduce(
      (total, payment) => total + toNumber(payment.amount),
      0
    );

    // 5. Số lượt đặt bàn theo ngày.
    const bookingRows = (await Reservation.findAll({
      attributes: [
        [fn("DATE", col("reservation_time")), "date"],
        [fn("COUNT", col("id")), "count"],
      ],
      where: reservationWhere,
      group: [fn("DATE", col("reservation_time"))],
      order: [[fn("DATE", col("reservation_time")), "ASC"]],
      raw: true,
    })) as unknown as BookingByDayRow[];

    const bookingByDay = bookingRows.map((item) => ({
      date: String(item.date),
      count: toNumber(item.count),
    }));

    // 6. Phân bố trạng thái bàn.
    const tableStatus = [
      {
        status: "available",
        count: availableTableCount,
      },
      {
        status: "reserved",
        count: reservedTableCount,
      },
      {
        status: "occupied",
        count: occupiedTableCount,
      },
    ];

    // 7. Top 5 món bán chạy.
    // Không tính món thuộc đơn đã hủy hoặc đơn bị xóa mềm.
    const topDishRows = (await OrderItem.findAll({
      attributes: [
        "menu_item_id",
        [fn("SUM", col("quantity")), "totalSold"],
      ],
      where: {
        status: {
          [Op.ne]: "cancelled",
        },
      },
      include: [
        {
          model: Order,
          attributes: [],
          where: {
            ...orderWhere,
            status: {
              [Op.ne]: "cancelled",
            },
          },
          required: true,
        },
      ],
      group: ["menu_item_id"],
      order: [[fn("SUM", col("quantity")), "DESC"]],
      limit: 5,
      raw: true,
    })) as unknown as TopDishRow[];

    const topDishes = await Promise.all(
      topDishRows.map(async (item) => {
        const menuItemId = Number(item.menu_item_id);

        const menuItem = (await Menu.findByPk(menuItemId, {
          attributes: ["id", "name"],
        })) as unknown as MenuItemRow | null;

        return {
          menu_item_id: menuItemId,
          name: menuItem?.name ?? "Món không xác định",
          totalSold: toNumber(item.totalSold),
        };
      })
    );

    // 8. Năm đơn hàng gần nhất.
    const recentOrders = await Order.findAll({
      where: orderWhere,
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    // 9. Trả dữ liệu cho frontend.
    return res.status(200).json({
      menu: menuCount,
      orders: orderCount,
      tables: availableTableCount,
      bookings: bookingCount,
      revenue,
      pendingOrders: pendingOrderCount,
      bookingByDay,
      tableStatus,
      topDishes,
      recentOrders,
    });
  } catch (error: unknown) {
    console.error("Lỗi getDashboard:", error);

    return res.status(500).json({
      message: "Không thể tải dữ liệu Dashboard",
      error:
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không xác định",
    });
  }
};
