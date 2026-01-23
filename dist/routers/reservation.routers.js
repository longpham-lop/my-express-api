"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReservationController_1 = require("../controllers/ReservationController");
const router = (0, express_1.Router)();
// /api/reservations
router.post("/", ReservationController_1.createReservation);
router.get("/", ReservationController_1.getReservations);
router.put("/:id/status", ReservationController_1.updateReservationStatus);
exports.default = router;
