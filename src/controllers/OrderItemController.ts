import { Response } from "express";
import OrderItem from "../models/OrderItem";
import Order from "../models/Order";
import MenuItem from "../models/Menu";
import { AuthRequest } from "../middlewares/auth.middleware";

/* ===== HELPER: UPDATE TOTAL ===== */
const updateOrderTotal = async (order_id: number) => {
  const items = await OrderItem.findAll({
    where: { order_id },
  });

  const total_price = items.reduce(
    (sum, i: any) => sum + i.unit_price * i.quantity,
    0
  );

  await Order.update({ total_price }, { where: { id: order_id } });
};

/* ================= GET MY ITEMS ================= */
export const getMyOrderItems = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const data = await OrderItem.findAll({
      include: [
        {
          model: Order,
          where: { user_id: req.user.id },
        },
        {
          model: MenuItem,
          as: "menu",
        },
      ],
    });

    res.json(data);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= CREATE ================= */
export const createOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { order_id, menu_item_id, quantity } = req.body;

    if (!order_id || !menu_item_id || !quantity) {
      return res.status(400).json({ message: "Thiếu dữ liệu" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ message: "Quantity phải > 0" });
    }

    const order = await Order.findByPk(order_id);
    if (!order || order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const menuItem = await MenuItem.findByPk(menu_item_id);
    if (!menuItem) {
      return res.status(404).json({ message: "MenuItem không tồn tại" });
    }

    const item = await OrderItem.create({
      order_id,
      menu_item_id,
      quantity,
      unit_price: menuItem.price,
    });

    await updateOrderTotal(order_id);

    res.status(201).json(item);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= UPDATE ================= */
export const updateOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);
    const { quantity } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ message: "Quantity không hợp lệ" });
    }

    const item = await OrderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "OrderItem không tồn tại" });
    }

    const order = await Order.findByPk(item.order_id);

    if (!order || order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await item.update({ quantity });

    await updateOrderTotal(order.id);

    res.json(item);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= DELETE ================= */
export const deleteOrderItem = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const item = await OrderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "OrderItem không tồn tại" });
    }

    const order = await Order.findByPk(item.order_id);

    if (!order || order.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await item.destroy();

    await updateOrderTotal(order.id);

    res.json({ message: "Deleted successfully" });

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};