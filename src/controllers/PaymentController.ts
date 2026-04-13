import { Request, Response } from "express";
import Payment from "../models/Payment";
import Order from "../models/Order";

/* ===== CREATE ===== */
export const createPayment = async (req: Request, res: Response) => {
  try {
    const { order_id, method } = req.body;

    if (!order_id || !method) {
      return res.status(400).json({
        message: "order_id và method là bắt buộc",
      });
    }

    const validMethods = ["cash", "momo", "vnpay", "bank"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        message: "Phương thức thanh toán không hợp lệ",
      });
    }

    const orderId = Number(order_id);
    if (isNaN(orderId)) {
      return res.status(400).json({
        message: "order_id không hợp lệ",
      });
    }

    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    // ❗ tránh thanh toán lại
    const exist = await Payment.findOne({
      where: { order_id: orderId },
    });

    if (exist) {
      return res.status(400).json({
        message: "Order đã được thanh toán",
      });
    }

    const payment = await Payment.create({
      order_id: orderId,
      method,
      amount: order.total_price,
      status: "success",
    });

    // update order
    await order.update({
      status: "paid",
    });

    return res.status(201).json({
      message: "Thanh toán thành công",
      data: payment,
    });

  } catch (err: any) {
    return res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};

/* ===== GET ALL ===== */
export const getPayments = async (req: Request, res: Response) => {
  try {
    const payments = await Payment.findAll({
      include: [
        {
          model: Order,
          attributes: ["id", "total_price", "status"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.json(payments);
  } catch (err: any) {
    return res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};

/* ===== GET BY ID ===== */
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: Order,
          attributes: ["id", "total_price", "status"],
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment không tồn tại",
      });
    }

    return res.json(payment);

  } catch (err: any) {
    return res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};

/* ===== GET BY ORDER ===== */
export const getPaymentByOrder = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId);

    if (isNaN(orderId)) {
      return res.status(400).json({
        message: "orderId không hợp lệ",
      });
    }

    const payment = await Payment.findOne({
      where: { order_id: orderId },
      include: [
        {
          model: Order,
          attributes: ["id", "total_price", "status"],
        },
      ],
    });

    if (!payment) {
      return res.status(404).json({
        message: "Payment không tồn tại",
      });
    }

    return res.json(payment);

  } catch (err: any) {
    return res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};

/* ===== UPDATE STATUS ===== */
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const validStatus = ["pending", "success", "failed"];
    if (!validStatus.includes(status)) {
      return res.status(400).json({
        message: "Status không hợp lệ",
      });
    }

    const payment = await Payment.findByPk(id);

    if (!payment) {
      return res.status(404).json({
        message: "Payment không tồn tại",
      });
    }

    await payment.update({ status });

    return res.json({
      message: "Cập nhật payment thành công",
      data: payment,
    });

  } catch (err: any) {
    return res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};