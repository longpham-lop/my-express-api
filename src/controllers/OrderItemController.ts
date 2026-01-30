import { Request, Response } from "express";
import OrderItem from "../models/OrderItem";
import Order from "../models/Order";
import MenuItem from "../models/MenuItem";

export const getAllOrderItems = async (req: Request, res: Response) => {
  try {
    const items = await OrderItem.findAll({
      include: [Order, MenuItem], // load quan hệ
    });
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createOrderItem = async (req: Request, res: Response) => {
  try {
    const { order_id, menu_item_id, quantity } = req.body;

    // 1️⃣ check order tồn tại
    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(400).json({ message: "Order không tồn tại" });
    }

    // 2️⃣ check menu item tồn tại
    const menuItem = await MenuItem.findByPk(menu_item_id);
    if (!menuItem) {
      return res.status(400).json({ message: "MenuItem không tồn tại" });
    }
    const unit_price = menuItem.price;
    // 3️⃣ tạo order item
    const item = await OrderItem.create({
      order_id,
      menu_item_id,
      quantity,
      unit_price,
     
    });

    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
export const deleteOrderItem = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const item = await OrderItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: "OrderItem không tồn tại" });
    }

    await item.destroy();
    res.json({ message: "Deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
