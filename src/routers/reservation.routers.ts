import { Router } from "express";
import { ReservationController } from "../controllers/ReservationController";

const router = Router();

router.post("/", ReservationController.create);
router.put("/:id/cancel", ReservationController.cancel);

export default router;
