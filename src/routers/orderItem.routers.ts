
import { Router } from "express";
import {
  getMyOrderItems,
  createOrderItem,
  deleteOrderItem,
  updateOrderItem,
  updateOrderItemStatus,
} from "../controllers/OrderItemController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.get("/", authMiddleware, getMyOrderItems); 
router.post("/", authMiddleware, createOrderItem);
router.delete("/:id", authMiddleware, deleteOrderItem);
router.put("/:id", authMiddleware, updateOrderItem);

// Cập nhật trạng thái món: pending → cooking → ready → served
router.put(
  "/:id/status",
  authMiddleware,
  updateOrderItemStatus
);

export default router;
