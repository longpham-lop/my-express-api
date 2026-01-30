import { Router } from "express";
import {
  getAllReservations,
  createReservation,
//   cancelReservation,
  getAllReservationsAdmin
} from "../controllers/ReservationController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/role.middleware";

const router = Router();

/**
 * USER
 */
router.post("/", authMiddleware, createReservation);              // tạo reservation
router.get("/", authMiddleware, getAllReservations);              // xem reservation của mình
// router.put("/:id/cancel", authMiddleware, cancelReservation);     // hủy reservation

/**
 * ADMIN
 */
router.get("/admin/all", authMiddleware, isAdmin, getAllReservationsAdmin);

export default router;
