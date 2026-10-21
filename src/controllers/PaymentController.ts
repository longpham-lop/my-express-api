import { Response } from "express";
import { Op } from "sequelize";
import sequelize from "../config/db";
import Payment from "../models/Payment";
import Order from "../models/Order";
import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];

const PAYMENT_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "cashier",
];

const isGlobalRole = (role?: string) =>
  !!role && GLOBAL_ROLES.includes(role);

const canManagePayments = (role?: string) =>
  !!role && PAYMENT_ROLES.includes(role);

const canAccessOrder = (
  role: string,
  branchId: number | null | undefined,
  orderBranchId: number | null | undefined
) => {
  if (isGlobalRole(role)) return true;

  return (
    branchId != null &&
    orderBranchId != null &&
    branchId === orderBranchId
  );
};

/* =========================================
   GET /api/payments
   Admin: toàn hệ thống
   Branch Manager / Cashier: chi nhánh của mình
========================================= */
export const getPayments = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const { role, branchId } = req.user;

    if (!canManagePayments(role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem thanh toán",
      });
    }

    let whereCondition: Record<string, unknown> = {};

    if (!isGlobalRole(role)) {
      if (branchId == null) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      const branchOrders = await Order.findAll({
        attributes: ["id"],
        where: {
          branch_id: branchId,
        },
      });

      const orderIds = branchOrders.map((order) => order.id);

      if (orderIds.length === 0) {
        return res.json([]);
      }

      whereCondition = {
        order_id: {
          [Op.in]: orderIds,
        },
      };
    }

    const payments = await Payment.findAll({
      where: whereCondition,
      include: [
        {
          model: Order,
          attributes: [
            "id",
            "branch_id",
            "total_price",
            "status",
            "is_deleted",
          ],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(payments);
  } catch (err: unknown) {
    console.error("GET PAYMENTS ERROR:", err);

    return res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Không thể lấy danh sách thanh toán",
    });
  }
};

/* =========================================
   POST /api/payments
   Ghi nhận khoản tiền đã nhận tại nhà hàng
========================================= */
export const createPayment = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const { role, branchId } = req.user;

    if (!canManagePayments(role)) {
      return res.status(403).json({
        message: "Bạn không có quyền ghi nhận thanh toán",
      });
    }

    const { order_id, method } = req.body;
    const orderId = Number(order_id);

    if (
      order_id === undefined ||
      order_id === null ||
      order_id === "" ||
      !Number.isSafeInteger(orderId) ||
      orderId <= 0
    ) {
      return res.status(400).json({
        message: "Mã đơn hàng không hợp lệ",
      });
    }

    const validMethods = ["cash", "bank"];

    if (
      typeof method !== "string" ||
      !validMethods.includes(method)
    ) {
      return res.status(400).json({
        message: "Phương thức thanh toán không hợp lệ",
      });
    }

    const result = await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(orderId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!order || order.is_deleted) {
        return {
          errorStatus: 404,
          message: "Đơn hàng không tồn tại",
        };
      }

      if (
        !canAccessOrder(
          role,
          branchId,
          order.branch_id
        )
      ) {
        return {
          errorStatus: 403,
          message: "Bạn không có quyền thanh toán đơn của chi nhánh khác",
        };
      }

      if (order.status !== "completed") {
        return {
          errorStatus: 400,
          message: "Đơn hàng chưa hoàn tất phục vụ",
        };
      }

      const existingPayment = await Payment.findOne({
        where: {
          order_id: orderId,
        },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (existingPayment) {
        return {
          errorStatus: 409,
          message: "Đơn hàng đã có bản ghi thanh toán",
        };
      }

      const amount = Number(order.total_price);

      if (!Number.isFinite(amount) || amount <= 0) {
        return {
          errorStatus: 400,
          message: "Tổng tiền đơn hàng không hợp lệ",
        };
      }

      const payment = await Payment.create(
        {
          order_id: orderId,
          method,
          amount,
          status: "success",
        },
        { transaction }
      );

      return {
        payment,
      };
    });

    if ("errorStatus" in result && result.errorStatus !== undefined) {
      return res.status(result.errorStatus).json({
        message: result.message,
      });
    }

    return res.status(201).json({
      message: "Ghi nhận thanh toán thành công",
      data: result.payment,
    });
  } catch (err: unknown) {
    console.error("CREATE PAYMENT ERROR:", err);

    return res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Không thể xử lý thanh toán",
    });
  }
};

/* =========================================
   GET /api/payments/:id
========================================= */
export const getPaymentById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canManagePayments(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem thanh toán",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Mã giao dịch không hợp lệ",
      });
    }

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: Order,
          attributes: [
            "id",
            "branch_id",
            "total_price",
            "status",
            "is_deleted",
          ],
          required: false,
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        message: "Giao dịch không tồn tại",
      });
    }

    const order = await Order.findByPk(payment.order_id);

    if (
      !order ||
      !canAccessOrder(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền xem giao dịch này",
      });
    }

    return res.json(payment);
  } catch (err: unknown) {
    console.error("GET PAYMENT BY ID ERROR:", err);

    return res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Không thể lấy giao dịch",
    });
  }
};

/* =========================================
   GET /api/payments/order/:orderId
========================================= */
export const getPaymentByOrder = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canManagePayments(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem thanh toán",
      });
    }

    const orderId = Number(req.params.orderId);

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        message: "Mã đơn hàng không hợp lệ",
      });
    }

    const order = await Order.findByPk(orderId);

    if (
      !order ||
      !canAccessOrder(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập",
      });
    }

    const payment = await Payment.findOne({
      where: {
        order_id: orderId,
      },
    });

    if (!payment) {
      return res.status(404).json({
        message: "Đơn hàng chưa có bản ghi thanh toán",
      });
    }

    return res.json(payment);
  } catch (err: unknown) {
    console.error("GET PAYMENT BY ORDER ERROR:", err);

    return res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Không thể lấy thanh toán theo đơn hàng",
    });
  }
};

/* =========================================
   PUT /api/payments/:id/status
========================================= */
export const updatePaymentStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canManagePayments(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật thanh toán",
      });
    }

    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "Mã giao dịch không hợp lệ",
      });
    }

    const validStatuses = ["pending", "success", "failed"];

    if (
      typeof status !== "string" ||
      !validStatuses.includes(status)
    ) {
      return res.status(400).json({
        message: "Trạng thái thanh toán không hợp lệ",
      });
    }

    const payment = await Payment.findByPk(id);

    if (!payment) {
      return res.status(404).json({
        message: "Giao dịch không tồn tại",
      });
    }

    const order = await Order.findByPk(payment.order_id);

    if (
      !order ||
      !canAccessOrder(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật giao dịch này",
      });
    }

    // Không cho đánh dấu thành công nếu đơn chưa hoàn tất.
    if (status === "success" && order.status !== "completed") {
      return res.status(400).json({
        message: "Đơn hàng chưa hoàn tất phục vụ",
      });
    }

    await payment.update({
      status,
    });

    return res.json({
      message: "Cập nhật trạng thái thanh toán thành công",
      data: payment,
    });
  } catch (err: unknown) {
    console.error("UPDATE PAYMENT STATUS ERROR:", err);

    return res.status(500).json({
      message:
        err instanceof Error
          ? err.message
          : "Không thể cập nhật thanh toán",
    });
  }
};




