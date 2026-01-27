import { Router } from "express";
import {getAllOrders, createOrder} from "../controllers/OrderController";

const router = Router();

// /api/orders
router.post("/", createOrder);
router.get("/", getAllOrders);
router.get("/:id", getAllOrders);
router.put("/:id/status", getAllOrders);

export default router;
