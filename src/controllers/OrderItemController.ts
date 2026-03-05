import { Request, Response } from "express";
import OrderItem from "../models/OrderItem";
import Order from "../models/Order";
import MenuItem from "../models/Menu";
import { AuthRequest } from "../middlewares/auth.middleware";

export const getMyOrderItems = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const items = await OrderItem.findAll({
    include: [
      {
        model: Order,
        where: { user_id: req.user.id },
      },
      MenuItem,
    ],
  });

  res.json(items);
};


export const createOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { order_id, menu_item_id, quantity } = req.body;

    if (!order_id || !menu_item_id || !quantity) {
      return res.status(400).json({ message: "Thiếu dữ liệu" });
    }

    // 1️⃣ check order tồn tại & thuộc về user
    const order = await Order.findByPk(order_id);
    if (!order || order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // 2️⃣ check menu item
    const menuItem = await MenuItem.findByPk(menu_item_id);
    if (!menuItem) {
      return res.status(400).json({ message: "MenuItem không tồn tại" });
    }

    // 3️⃣ tạo order item
    const item = await OrderItem.create({
      order_id,
      menu_item_id,
      quantity,
      unit_price: menuItem.price, // ⭐ backend quyết định
    });

    // 4️⃣ cập nhật total_price
    const items = await OrderItem.findAll({ where: { order_id } });
    const total_price = items.reduce(
      (sum, i: any) => sum + i.unit_price * i.quantity,
      0
    );

    await order.update({ total_price });

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
  
export const deleteOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const item = await OrderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "OrderItem không tồn tại" });
    }

    const order = await Order.findByPk(item.order_id);
    if (!order || order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await item.destroy();

    // cập nhật lại tổng tiền
    const items = await OrderItem.findAll({
      where: { order_id: order.id },
    });

    const total_price = items.reduce(
      (sum, i: any) => sum + i.unit_price * i.quantity,
      0
    );

    await order.update({ total_price });

    res.json({ message: "Deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
export const updateOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const { quantity } = req.body;

    if (!quantity) {
      return res.status(400).json({ message: "Quantity là bắt buộc" });
    }

    const item = await OrderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "OrderItem không tồn tại" });
    }

    const order = await Order.findByPk(item.order_id);

    if (!order || order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // update quantity
    await item.update({ quantity });

    // cập nhật total_price
    const items = await OrderItem.findAll({
      where: { order_id: order.id },
    });

    const total_price = items.reduce(
      (sum, i: any) => sum + i.unit_price * i.quantity,
      0
    );

    await order.update({ total_price });

    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};