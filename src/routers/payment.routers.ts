
import express from "express";
import {
  createPayment,
  getPayments,
  getPaymentById,
  getPaymentByOrder,
  updatePaymentStatus,
} from "../controllers/PaymentController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = express.Router();

// Bắt buộc xác thực JWT cho tất cả API thanh toán
router.use(authMiddleware);

// Danh sách giao dịch
router.get("/", getPayments);

// Tra cứu thanh toán theo đơn hàng
router.get("/order/:orderId", getPaymentByOrder);

// Chi tiết giao dịch
router.get("/:id", getPaymentById);

// Ghi nhận thanh toán
router.post("/", createPayment);

// Cập nhật trạng thái thanh toán
router.put("/:id/status", updatePaymentStatus);

export default router;
