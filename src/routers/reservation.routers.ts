import { Router } from "express";

import {
  getMyReservations,
  createReservation,
  cancelReservation,
  getAllReservationsAdmin,
  getReservationById,
  updateReservation,
  deleteReservation,
} from "../controllers/ReservationController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { requireBranchManager } from "../middlewares/permission.middleware";

import {
  checkAvailability,
  createOnlineReservation,
  createPhoneReservation,
  requestReservationOtp,
} from "../controllers/ReservationPhase2Controller";

const router = Router();

/*
|--------------------------------------------------------------------------
| PUBLIC RESERVATION
|--------------------------------------------------------------------------
*/

router.post("/availability", checkAvailability);

router.post("/otp/request", requestReservationOtp);

router.post("/online", createOnlineReservation);

router.post(
  "/phone",
  authMiddleware,
  requireBranchManager,
  createPhoneReservation
);

/*
|--------------------------------------------------------------------------
| ADMIN / MANAGEMENT
|--------------------------------------------------------------------------
*/

// Admin + chain_manager + branch_manager
router.get(
  "/admin",
  authMiddleware,
  requireRole("admin", "chain_manager", "branch_manager"),
  getAllReservationsAdmin
);

/*
|--------------------------------------------------------------------------
| USER
|--------------------------------------------------------------------------
*/

router.get("/", authMiddleware, getMyReservations);

/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/

router.post("/", createReservation);

/*
|--------------------------------------------------------------------------
| UPDATE / CANCEL
|--------------------------------------------------------------------------
*/

router.put("/:id/cancel", authMiddleware, cancelReservation);

router.put("/:id", authMiddleware, updateReservation);

/*
|--------------------------------------------------------------------------
| GET BY ID
|--------------------------------------------------------------------------
*/

router.get("/:id", authMiddleware, getReservationById);

/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  authMiddleware,
  requireRole("admin", "chain_manager", "branch_manager"),
  deleteReservation
);

export default router;