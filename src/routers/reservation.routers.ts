import { Router } from "express";
import {
  createReservation,
  getReservations,
  updateReservationStatus,
} from "../controllers/ReservationController";

const router = Router();

// /api/reservations
router.post("/", createReservation);
router.get("/", getReservations);
router.put("/:id/status", updateReservationStatus);

export default router;
