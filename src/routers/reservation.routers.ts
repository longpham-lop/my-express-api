import { Router } from "express";

import {
  checkReservationAvailability,
  createReservation,
  getMyReservations,
  getAllReservationsAdmin,
  getReservationById,
  updateReservation,
  deleteReservation,
  confirmReservation,
  checkInReservation,
  completeReservation,
  cancelReservation,
  requestReservationOtp,
  createOnlineReservation,
} from "../controllers/ReservationController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

/*
 * =========================================================
 * CUSTOMER / USER
 * =========================================================
 */
router.post(
  "/availability",
  checkReservationAvailability
);

// Tạo đặt bàn
router.post(
  "/",
  createReservation
);
router.post(
  "/otp/request",
  requestReservationOtp
);

router.post(
  "/online",
  createOnlineReservation
);
// Xem đặt bàn của chính mình
router.get(
  "/my",
  authMiddleware,
  getMyReservations
);

/*
 * =========================================================
 * ADMIN
 * =========================================================
 */

// Danh sách tất cả reservation
router.get(
  "/admin",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  getAllReservationsAdmin
);

// Chi tiết
router.get(
  "/:id",
  authMiddleware,
  getReservationById
);

// Cập nhật thông tin
router.put(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  updateReservation
);

// Xác nhận
router.put(
  "/:id/confirm",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  confirmReservation
);

// Check-in
router.put(
  "/:id/check-in",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  checkInReservation
);

// Hoàn tất
router.put(
  "/:id/complete",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  completeReservation
);

// Hủy
router.put(
  "/:id/cancel",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  cancelReservation
);

// Xóa
router.delete(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  deleteReservation
);

export default router;