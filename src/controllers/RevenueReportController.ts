
import { Response } from "express";
import { Op } from "sequelize";

import Payment from "../models/Payment";
import Order from "../models/Order";
import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];

const REPORT_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

export const getRevenueReport = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // 1. Kiểm tra đăng nhập
    if (!req.user) {
      return res.status(401).json({
        message: "Bạn chưa đăng nhập",
      });
    }

    // 2. Kiểm tra quyền xem báo cáo
    if (!REPORT_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem báo cáo doanh thu",
      });
    }

    // 3. Lấy khoảng thời gian từ query
    const { start_date, end_date, branch_id } = req.query;

    const now = new Date();

    // Mặc định: từ đầu tháng hiện tại đến hiện tại
    const defaultStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

    const startDate = start_date
      ? new Date(`${String(start_date)}T00:00:00`)
      : defaultStart;

    const endDate = end_date
      ? new Date(`${String(end_date)}T00:00:00`)
      : now;

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      return res.status(400).json({
        message: "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ",
      });
    }

    if (startDate > endDate) {
      return res.status(400).json({
        message: "Ngày bắt đầu không được sau ngày kết thúc",
      });
    }

    // Nếu người dùng truyền end_date, lấy trọn ngày đó.
    // Dùng mốc đầu ngày kế tiếp để không bỏ sót giao dịch cuối ngày.
    const endExclusive = end_date
      ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000)
      : new Date(endDate.getTime() + 1);

    // 4. Xây dựng điều kiện lọc đơn hàng theo chi nhánh
    const orderWhere: {
      branch_id?: number;
      is_deleted?: boolean;
    } = {
      is_deleted: false,
    };

    if (GLOBAL_ROLES.includes(req.user.role)) {
      // Admin và quản lý chuỗi được xem tất cả chi nhánh
      if (branch_id !== undefined) {
        const branchId = Number(branch_id);

        if (!Number.isInteger(branchId) || branchId <= 0) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        orderWhere.branch_id = branchId;
      }
    } else {
      // Quản lý chi nhánh chỉ xem dữ liệu chi nhánh của mình
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      orderWhere.branch_id = req.user.branchId;
    }

    // 5. Lấy các giao dịch thành công trong khoảng thời gian
    const payments = await Payment.findAll({
      where: {
        status: "success",
        createdAt: {
          [Op.gte]: startDate,
          [Op.lt]: endExclusive,
        },
      },
      include: [
        {
          model: Order,
          attributes: [
            "id",
            "branch_id",
            "total_price",
            "status",
          ],
          where: orderWhere,
          required: true,
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    // 6. Tổng hợp số liệu
    let totalRevenue = 0;

    const dailyRevenue: Record<
      string,
      { revenue: number; transactions: number }
    > = {};

    const methodRevenue: Record<
      string,
      { revenue: number; transactions: number }
    > = {};

    for (const payment of payments) {
      const amount = Number(payment.amount) || 0;
      const paymentDate = new Date(payment.createdAt);
      const dateKey = [
        paymentDate.getFullYear(),
        String(paymentDate.getMonth() + 1).padStart(2, "0"),
        String(paymentDate.getDate()).padStart(2, "0"),
      ].join("-");

      const method = payment.method;

      totalRevenue += amount;

      if (!dailyRevenue[dateKey]) {
        dailyRevenue[dateKey] = {
          revenue: 0,
          transactions: 0,
        };
      }

      dailyRevenue[dateKey].revenue += amount;
      dailyRevenue[dateKey].transactions += 1;

      if (!methodRevenue[method]) {
        methodRevenue[method] = {
          revenue: 0,
          transactions: 0,
        };
      }

      methodRevenue[method].revenue += amount;
      methodRevenue[method].transactions += 1;
    }

    const transactionCount = payments.length;

    const averageTransaction = transactionCount > 0
      ? totalRevenue / transactionCount
      : 0;

    // 7. Trả dữ liệu về frontend
    return res.json({
      message: "Lấy báo cáo doanh thu thành công",
      filters: {
        start_date: startDate.toISOString().slice(0, 10),
        end_date: end_date
          ? String(end_date)
          : now.toISOString().slice(0, 10),
        branch_id: orderWhere.branch_id ?? null,
      },
      summary: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        transaction_count: transactionCount,
        average_transaction: Number(
          averageTransaction.toFixed(2)
        ),
      },
      daily_revenue: Object.entries(dailyRevenue).map(
        ([date, data]) => ({
          date,
          revenue: Number(data.revenue.toFixed(2)),
          transactions: data.transactions,
        })
      ),
      payment_methods: Object.entries(methodRevenue).map(
        ([method, data]) => ({
          method,
          revenue: Number(data.revenue.toFixed(2)),
          transactions: data.transactions,
        })
      ),
    });
  } catch (error: unknown) {
    console.error("GET REVENUE REPORT ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy báo cáo doanh thu",
      error:
        error instanceof Error
          ? error.message
          : "Lỗi không xác định",
    });
  }
};
