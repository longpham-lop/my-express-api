"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReservationController_1 = require("../controllers/ReservationController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
/**
 * USER
 */
// tạo reservation
/* ================= ADMIN ================= */
router.get("/admin", auth_middleware_1.authMiddleware, role_middleware_1.isAdmin, ReservationController_1.getAllReservationsAdmin);
/* ================= USER ================= */
router.get("/", auth_middleware_1.authMiddleware, ReservationController_1.getMyReservations);
router.post("/", ReservationController_1.createReservation);
router.put("/:id/cancel", auth_middleware_1.authMiddleware, ReservationController_1.cancelReservation);
router.put("/:id", auth_middleware_1.authMiddleware, ReservationController_1.updateReservation);
router.get("/:id", auth_middleware_1.authMiddleware, ReservationController_1.getReservationById);
router.delete("/:id", auth_middleware_1.authMiddleware, role_middleware_1.isAdmin, ReservationController_1.deleteReservation);
exports.default = router;
