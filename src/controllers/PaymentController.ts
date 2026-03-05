// src/controllers/payment.controller.ts
import { Request, Response } from "express";
import Payment from "../models/Payment";
import Order from "../models/Order";

// CREATE PAYMENT
export const createPayment = async (req: Request, res: Response) => {
  try {
    const { order_id, method } = req.body;

    // validate order_id
    if (!order_id) {
      return res.status(400).json({ message: "order_id là bắt buộc" });
    }

    // validate method
    const validMethods = ["cash", "momo", "vnpay", "bank"];
    if (!validMethods.includes(method)) {
      return res.status(400).json({ message: "Phương thức thanh toán không hợp lệ" });
    }

    // tìm order
    const order = await Order.findByPk(order_id);

    if (!order) {
      return res.status(404).json({ message: "Order không tồn tại" });
    }

    // check order đã có payment chưa
    const existingPayment = await Payment.findOne({
      where: { order_id },
    });

    if (existingPayment) {
      return res.status(400).json({ message: "Order đã được thanh toán" });
    }

    // tạo payment
    const payment = await Payment.create({
      order_id,
      method,
      amount: order.total_price,
      status: "success",
    });

    // update trạng thái order
    await order.update({
      status: "paid",
    });

    return res.status(201).json({
      message: "Thanh toán thành công",
      data: payment,
    });

  } catch (err: any) {
    console.error("Payment error:", err);
    res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};



// GET ALL PAYMENTS
export const getAllPayments = async (req: Request, res: Response) => {
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

    res.json(payments);
  } catch (err: any) {
    res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};



// GET PAYMENT BY ID
export const getPaymentById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

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

    res.json(payment);

  } catch (err: any) {
    res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};



// GET PAYMENT BY ORDER
export const getPaymentByOrder = async (req: Request, res: Response) => {
  try {
    const orderId = Number(req.params.orderId);

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

    res.json(payment);

  } catch (err: any) {
    res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};



// UPDATE PAYMENT STATUS
export const updatePaymentStatus = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

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

    payment.status = status;
    await payment.save();

    res.json({
      message: "Cập nhật payment thành công",
      data: payment,
    });

  } catch (err: any) {
    res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};