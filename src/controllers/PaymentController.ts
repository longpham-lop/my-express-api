import { Request, Response } from "express";
import { Payment } from "../models/Payment";

export class PaymentController {
  static async create(req: Request, res: Response) {
    try {
      const { order_id, payment_method } = req.body;

      if (!order_id || !payment_method) {
        return res.status(400).json({
          message: "order_id và payment_method là bắt buộc"
        });
      }

      const payment = await Payment.create({
        order_id,
        payment_method
      });

      res.status(201).json(payment);
    } catch (error: any) {
      res.status(500).json({
        message: "Tạo payment thất bại",
        error: error.message
      });
    }
  }
}
