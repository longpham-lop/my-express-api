import { Router } from "express";
import {
  getMyReservations,
  createReservation,
  cancelReservation,
  getAllReservationsAdmin,
  getReservationById,
  updateReservation,  
  deleteReservation
} from "../controllers/ReservationController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/role.middleware";
import { requireBranchManager } from "../middlewares/permission.middleware";
import { checkAvailability, createOnlineReservation, createPhoneReservation, requestReservationOtp } from "../controllers/ReservationPhase2Controller";

const router = Router();

// Public reservation flow: availability -> OTP -> booking confirmation.
router.post("/availability", checkAvailability);
router.post("/otp/request", requestReservationOtp);
router.post("/online", createOnlineReservation);
router.post("/phone", authMiddleware, requireBranchManager, createPhoneReservation);

/**
 * USER
 */
// tạo reservation
/* ================= ADMIN ================= */
router.get("/admin", authMiddleware, isAdmin, getAllReservationsAdmin);

/* ================= USER ================= */
router.get("/", authMiddleware, getMyReservations);
router.post("/", createReservation);
router.put("/:id/cancel", authMiddleware, cancelReservation);
router.put("/:id", authMiddleware, updateReservation);
router.get("/:id", authMiddleware, getReservationById);
router.delete("/:id", authMiddleware, isAdmin, deleteReservation);

export default router;
