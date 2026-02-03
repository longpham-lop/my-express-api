import { Request, Response } from "express";
import Order from "../models/Order";
import User from "../models/User";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role_id: number;
  };
}

/**
 * GET /api/orders
 * - ADMIN: xem tất cả orders
 * - USER: chỉ xem orders của chính mình
 */
export const getAllOrders = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // ADMIN
    if (req.user.role_id === 1) {
      const orders = await Order.findAll({
        order: [["createdAt", "DESC"]],
      });
      return res.json(orders);
    }

    // USER
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/orders/:id
 * - ADMIN: xem bất kỳ order nào
 * - USER: chỉ xem order của mình
 */
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const id = Number(req.params.id)
    if(isNaN(id)){
      return res.status(400).json({ message: "ID không hợp lệ" });
    }
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ message: "Order không tồn tại" });
    }

    // USER không được xem order của người khác
    if (req.user.role_id !== 1 && order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * POST /api/orders
 * - USER: tạo order cho chính mình
 * - ADMIN: cũng có thể tạo (nếu muốn)
 */
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { reservation_id, total_price } = req.body;

    if (!total_price) {
      return res.status(400).json({ message: "total_price là bắt buộc" });
    }

    const order = await Order.create({
      user_id: req.user.id,
      reservation_id: reservation_id || null,
      total_price,
      status: "pending",
    });
  
    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * PUT /api/orders/:id/status
 * - CHỈ ADMIN được đổi trạng thái
 */
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role_id !== 1) {
      return res.status(403).json({ message: "Admin only" });
    }
    const id = Number(req.params.id)
    if(isNaN(id)){
      return res.status(400).json({ message: "ID không hợp lệ" });
    }
    const { status } = req.body;
    const order = await Order.findByPk(id);

    if (!order) {
      return res.status(404).json({ message: "Order không tồn tại" });
    }

    await order.update({ status });
    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * DELETE /api/orders/:id
 * - CHỈ ADMIN
 */
export const deleteOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || req.user.role_id !== 1) {
      return res.status(403).json({ message: "Admin only" });
    }
    const id = Number(req.params.id)
    if(isNaN(id)){
      return res.status(400).json({ message: "ID không hợp lệ" });
    }
    const order = await Order.findByPk(id);
    if (!order) {
      return res.status(404).json({ message: "Order không tồn tại" });
    }

    await order.destroy();
    res.json({ message: "Xóa order thành công" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
// GET /orders/my
export const getMyOrders = async (req: AuthRequest, res: Response) => {
  const orders = await Order.findAll({
    where: { user_id: req.user?.id },
  });
  res.json(orders);
};
