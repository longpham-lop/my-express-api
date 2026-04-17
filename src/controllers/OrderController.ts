import { Request, Response } from "express";
import Order from "../models/Order";
import Reservation from "../models/Reservation";
import OrderItem from "../models/OrderItem";
import MenuItem from "../models/Menu";
import TableModel from "../models/Table";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
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
    if (req.user.role === "admin") {
      const orders = await Order.findAll({
        order: [["createdAt", "DESC"]],
        include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: ["name", "price", "image"],
            },
          ],
        },
        ],
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
export const getOrderDetail = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: ["name", "price", "image"],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: ["name", "price", "image"],
            },
          ],
        },
      ],
    });

    // ✅ FIX 1: check null trước
    if (!order) {
      return res.status(404).json({ message: "Order không tồn tại" });
    }

    // ✅ FIX 2: sau đó mới check quyền
    if (req.user.role !== "admin" && order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(order);

  } catch (err: unknown) {
    if (err instanceof Error) {
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: "Unknown error" });
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
    if (!req.user || req.user.role !== "admin") {
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

    // ✅ update reservation theo order
    if (order.reservation_id) {
      const reservation = await Reservation.findByPk(order.reservation_id);

      if (reservation) {
        let reservationStatus = reservation.status;

        if (status === "processing") {
          reservationStatus = "confirmed";
        }

        if (status === "completed") {
          reservationStatus = "completed";
        }

        await reservation.update({ status: reservationStatus });
      }
    
        if (status === "completed" && reservation) {
          const table = await TableModel.findByPk(reservation.table_id);

        if (table) {
          await table.update({ status: "available" });
      }
    }
    }
    return res.json({ message: "Cập nhật thành công", order });

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
    if (!req.user || req.user.role !== "admin") {
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
