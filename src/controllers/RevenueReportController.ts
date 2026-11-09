import { Response } from "express";
import { Op, WhereOptions } from "sequelize";

import Payment from "../models/Payment";
import Order from "../models/Order";
import StaffBranch from "../models/StaffBranch";
import { AuthRequest } from "../middlewares/auth.middleware";

const REPORT_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const VIETNAM_OFFSET_HOURS = 7;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Lấy ngày hiện tại theo múi giờ Việt Nam.
 * Kết quả: YYYY-MM-DD.
 */
const getVietnamDate = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
};

/**
 * Chuyển ngày YYYY-MM-DD theo giờ Việt Nam
 * thành mốc UTC để truy vấn database.
 */
const getVietnamDateBoundary = (
  dateString: string
): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(
    Date.UTC(year, month - 1, day)
  );

  // Kiểm tra ngày thực tế có hợp lệ không.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  // 00:00 giờ Việt Nam = 17:00 UTC ngày hôm trước.
  return new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      -VIETNAM_OFFSET_HOURS
    )
  );
};

export const getRevenueReport = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // =====================================================
    // 1. AUTHENTICATION & PERMISSION
    // =====================================================

    if (!req.user) {
      return res.status(401).json({
        message: "Bạn chưa đăng nhập",
      });
    }

    const { role, id, branchId } = req.user;

    if (!REPORT_ROLES.includes(role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem báo cáo doanh thu",
      });
    }

    // =====================================================
    // 2. DATE FILTER
    // =====================================================

    const today = getVietnamDate(new Date());
    const currentMonth = `${today.slice(0, 7)}-01`;

    const startDateString =
      req.query.start_date !== undefined
        ? String(req.query.start_date)
        : currentMonth;

    const endDateString =
      req.query.end_date !== undefined
        ? String(req.query.end_date)
        : today;

    const startDate =
      getVietnamDateBoundary(startDateString);

    const endDate =
      getVietnamDateBoundary(endDateString);

    if (!startDate || !endDate) {
      return res.status(400).json({
        message:
          "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ. Định dạng yêu cầu: YYYY-MM-DD",
      });
    }

    if (startDate.getTime() > endDate.getTime()) {
      return res.status(400).json({
        message:
          "Ngày bắt đầu không được sau ngày kết thúc",
      });
    }

    // Bao gồm toàn bộ ngày kết thúc.
    const endExclusive = new Date(
      endDate.getTime() + ONE_DAY_MS
    );

    // =====================================================
    // 3. DETERMINE ALLOWED BRANCHES
    // =====================================================

    let allowedBranchIds: number[] | null = null;

    // Branch Manager: chỉ được xem chi nhánh của mình.
    if (role === "branch_manager") {
      if (branchId == null) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      allowedBranchIds = [Number(branchId)];
    }

    // Chain Manager: chỉ xem các chi nhánh được phân công.
    if (role === "chain_manager") {
      const assignedBranches = await StaffBranch.findAll({
        attributes: ["branch_id"],
        where: {
          user_id: id,
        },
        raw: true,
      });

      allowedBranchIds = [
        ...new Set(
          assignedBranches.map((item) =>
            Number(item.branch_id)
          )
        ),
      ];

      if (allowedBranchIds.length === 0) {
        return res.status(403).json({
          message:
            "Tài khoản chưa được phân công chi nhánh quản lý",
        });
      }
    }

    // =====================================================
    // 4. VALIDATE SELECTED BRANCH
    // =====================================================

    let selectedBranchId: number | undefined;

    if (req.query.branch_id !== undefined) {
      const parsedBranchId = Number(req.query.branch_id);

      if (
        !Number.isSafeInteger(parsedBranchId) ||
        parsedBranchId <= 0
      ) {
        return res.status(400).json({
          message: "branch_id không hợp lệ",
        });
      }

      selectedBranchId = parsedBranchId;

      if (
        allowedBranchIds !== null &&
        !allowedBranchIds.includes(selectedBranchId)
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xem báo cáo của chi nhánh này",
        });
      }
    }

    // =====================================================
    // 5. BUILD ORDER FILTER
    // =====================================================

    const branchCondition: WhereOptions =
      selectedBranchId !== undefined
        ? {
            branch_id: selectedBranchId,
          }
        : allowedBranchIds !== null
          ? {
              branch_id: {
                [Op.in]: allowedBranchIds,
              },
            }
          : {};

    const orderWhere: WhereOptions = {
      is_deleted: false,
      status: {
        [Op.ne]: "cancelled",
      },
      ...branchCondition,
    };

    // =====================================================
    // 6. GET SUCCESSFUL PAYMENTS
    // =====================================================

    const payments = await Payment.findAll({
      attributes: [
        "id",
        "amount",
        "method",
        "createdAt",
      ],

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
          attributes: [],
          where: orderWhere,
          required: true,
        },
      ],

      order: [["createdAt", "ASC"]],
    });

    // =====================================================
    // 7. AGGREGATE REVENUE
    // =====================================================

    let totalRevenue = 0;

    const dailyRevenue: Record<
      string,
      {
        revenue: number;
        transactions: number;
      }
    > = {};

    const methodRevenue: Record<
      string,
      {
        revenue: number;
        transactions: number;
      }
    > = {};

    for (const payment of payments) {
      const amount = Number(payment.amount);

      if (!Number.isFinite(amount) || amount < 0) {
        continue;
      }

      const dateKey = getVietnamDate(
        new Date(payment.createdAt)
      );

      const method = String(payment.method);

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

    const transactionCount = Object.values(
      dailyRevenue
    ).reduce(
      (total, item) => total + item.transactions,
      0
    );

    const averageTransaction =
      transactionCount > 0
        ? totalRevenue / transactionCount
        : 0;

    // =====================================================
    // 8. RESPONSE
    // =====================================================

    return res.status(200).json({
      message: "Lấy báo cáo doanh thu thành công",

      filters: {
        start_date: startDateString,
        end_date: endDateString,
        branch_id: selectedBranchId ?? null,
      },

      summary: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        transaction_count: transactionCount,
        average_transaction: Number(
          averageTransaction.toFixed(2)
        ),
      },

      daily_revenue: Object.entries(dailyRevenue)
        .sort(([dateA], [dateB]) =>
          dateA.localeCompare(dateB)
        )
        .map(([date, data]) => ({
          date,
          revenue: Number(data.revenue.toFixed(2)),
          transactions: data.transactions,
        })),

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