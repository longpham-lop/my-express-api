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
    (sum, item) =>
      sum + Number(item.unit_price) * Number(item.quantity),
    0
  );

  await Order.update(
    { total_price },
    { where: { id: order_id } }
  );
};

const ALLOWED_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "kitchen",
  "waiter",
];

const STATUS_LIST = [
  "pending",
  "cooking",
  "ready",
  "served",
  "cancelled",
] as const;

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

export const updateOrderItemStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!ALLOWED_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật món",
      });
    }

    const itemId = Number(req.params.id);

    if (!Number.isInteger(itemId)) {
      return res.status(400).json({
        message: "ID món không hợp lệ",
      });
    }

    const { status } = req.body;

    if (!STATUS_LIST.includes(status)) {
      return res.status(400).json({
        message: "Trạng thái món không hợp lệ",
      });
    }

    const item = await OrderItem.findByPk(itemId);

    if (!item) {
      return res.status(404).json({
        message: "OrderItem không tồn tại",
      });
    }

    const order = await Order.findByPk(item.order_id);

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    // Branch manager / kitchen / waiter chỉ được thao tác
    // trên đơn thuộc chi nhánh của mình
    if (
      req.user.role !== "admin" &&
      req.user.role !== "chain_manager"
    ) {
      if (
        req.user.branchId === null ||
        req.user.branchId !== order.branch_id
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền thao tác đơn của chi nhánh này",
        });
      }
    }

    await item.update({
      status,
    });

    return res.status(200).json({
      message: "Cập nhật trạng thái món thành công",
      data: item,
    });
  } catch (error) {
    console.error("UPDATE ORDER ITEM STATUS ERROR:", error);

    return res.status(500).json({
      message: "Không thể cập nhật trạng thái món",
    });
  }
};