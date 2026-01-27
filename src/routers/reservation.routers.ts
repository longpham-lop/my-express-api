import { Router } from "express";
import { getAllReservations, createReservation } from "../controllers/ReservationController";

const router = Router();

router.post("/", createReservation);
router.put("/:id/cancel", getAllReservations);

export default router;
