import express from "express";
import {
  createPayment,
  getPayments,
  getPaymentById,
  getPaymentByOrder,
  updatePaymentStatus,
} from "../controllers/PaymentController";

const router = express.Router();

router.post("/", createPayment);
router.get("/", getPayments);
router.get("/:id", getPaymentById);
router.get("/order/:orderId", getPaymentByOrder);
router.put("/:id/status", updatePaymentStatus);

export default router;