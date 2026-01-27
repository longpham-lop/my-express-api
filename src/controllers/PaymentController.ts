import { Request, Response } from "express";
import Payment from "../models/Payment";
import Order, { OrderAttributes } from "../models/Order";

export class PaymentController {
  // Tạo Payment mới dựa vào Order
  static async create(req: Request, res: Response) {
    try {
      const { order_id, method } = req.body;

      // Tìm order
      const order: Order | null = await Order.findByPk(order_id);

      if (!order) {
        return res.status(400).json({ message: "Order không tồn tại" });
      }

      // Payment chuẩn type-safe
      const payment = await Payment.create({
        order_id,
        method,
        amount: order.total_price, // ✅ TypeScript hiểu là number
        status: "success",
      });

      res.status(201).json(payment);
    } catch (err: any) {
      console.error("Payment creation error:", err);
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  // Lấy tất cả payment
  static async getAll(req: Request, res: Response) {
    try {
      const payments = await Payment.findAll({ order: [["id", "DESC"]] });
      res.json(payments);
    } catch (err: any) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  // Lấy payment theo id
  static async getById(req: Request, res: Response) {
    try {
      const payment = await Payment.findByPk(Number(req.params.id));
      if (!payment) return res.status(404).json({ message: "Payment không tồn tại" });
      res.json(payment);
    } catch (err: any) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }

  // Cập nhật status payment
  static async updateStatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      const [updatedCount, updatedRows] = await Payment.update(
        { status },
        { where: { id }, returning: true }
      );

      if (updatedCount === 0) {
        return res.status(404).json({ message: "Payment không tồn tại" });
      }

      res.json(updatedRows[0]);
    } catch (err: any) {
      res.status(500).json({ message: "Lỗi server", error: err.message });
    }
  }
}
