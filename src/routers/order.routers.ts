import { Router } from "express";

import {
  getAllOrders,
  getMyOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
  getOrderDetail,
} from "../controllers/OrderController";
import { updateOrderItemStatus } from "../controllers/OrderItemController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/", getAllOrders);

router.get("/my", getMyOrders);

router.get("/orders/:id", getOrderDetail);

router.put("/items/:id/status", updateOrderItemStatus);

router.get("/:id", getOrderById);

router.post("/", createOrder);

router.put("/:id/status", updateOrderStatus);

router.delete("/:id", deleteOrder);

export default router;