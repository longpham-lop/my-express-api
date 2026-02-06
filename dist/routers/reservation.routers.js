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
router.post("/", auth_middleware_1.authMiddleware, ReservationController_1.createReservation); // tạo reservation
router.get("/", auth_middleware_1.authMiddleware, ReservationController_1.getAllReservations); // xem reservation của mình
// router.put("/:id/cancel", authMiddleware, cancelReservation);     // hủy reservation
/**
 * ADMIN
 */
router.get("/admin/all", auth_middleware_1.authMiddleware, role_middleware_1.isAdmin, ReservationController_1.getAllReservationsAdmin);
exports.default = router;
