import { Router } from "express";
import { createPayment,
        getAllPayments,
        getPaymentById,
        getPaymentByOrder,
        updatePaymentStatus
 } from "../controllers/PaymentController";

const router = Router();

router.post("/", createPayment);
router.get("/", getAllPayments);
router.get("/:id", getPaymentById);
router.get("/order/:orderId", getPaymentByOrder);
router.put("/:id", updatePaymentStatus);

export default router;
