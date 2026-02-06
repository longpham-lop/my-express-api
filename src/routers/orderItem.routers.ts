import { Router } from "express";
import {
  getMyOrderItems,
  createOrderItem,
  deleteOrderItem
} from "../controllers/OrderItemController";

const router = Router();

// Lấy tất cả order items
router.get("/", getMyOrderItems);

// Tạo order item
router.post("/", createOrderItem);

// Xóa order item theo id
router.delete("/:id", deleteOrderItem);

export default router;
