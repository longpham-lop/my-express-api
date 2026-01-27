import { Router } from "express";
import { getAllOrderItems, createOrderItem } from "../controllers/OrderItemController";

const router = Router();

router.post("/", createOrderItem);
router.delete("/:id", getAllOrderItems);

export default router;
