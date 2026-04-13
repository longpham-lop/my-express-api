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

const router = Router();

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
