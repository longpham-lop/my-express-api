import type { Request, Response } from "express";

// Tạo đơn gọi món
export const createOrder = (req: Request, res: Response) => {
  const { tableId, items } = req.body;

  res.json({
    message: "Order created",
    data: { tableId, items },
  });
};

// Lấy danh sách đơn
export const getOrders = (req: Request, res: Response) => {
  res.json({
    orders: [],
  });
};

// Lấy chi tiết đơn
export const getOrderById = (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    orderId: id,
  });
};

// Cập nhật trạng thái đơn
export const updateOrderStatus = (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  res.json({
    message: "Order status updated",
    orderId: id,
    status,
  });
};
