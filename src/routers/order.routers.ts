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
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/", getAllOrders);   
router.get("/orders/:id", getOrderDetail);        // /api/orders
router.get("/my", getMyOrders);           // /api/orders/my
router.get("/:id", getOrderById);         // /api/orders/:id
router.post("/", createOrder);            // create
router.put("/:id/status", updateOrderStatus);
router.delete("/:id", deleteOrder);  

export default router;
