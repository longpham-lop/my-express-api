import { Router } from "express";
import {
  getAllOrderItems,
  createOrderItem,
  deleteOrderItem
} from "../controllers/OrderItemController";

const router = Router();

// Lấy tất cả order items
router.get("/", getAllOrderItems);

// Tạo order item
router.post("/", createOrderItem);

// Xóa order item theo id
router.delete("/:id", deleteOrderItem);

export default router;
