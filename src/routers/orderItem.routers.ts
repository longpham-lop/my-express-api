import { Router } from "express";
import {
  getMyOrderItems,
  createOrderItem,
  deleteOrderItem,
  updateOrderItem
} from "../controllers/OrderItemController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Lấy tất cả order items
router.get("/", authMiddleware, getMyOrderItems);
  
// Tạo order item
router.post("/", authMiddleware, createOrderItem);

// Xóa order item theo id
router.delete("/:id", authMiddleware, deleteOrderItem);
router.put("/:id", authMiddleware, updateOrderItem);
export default router;
