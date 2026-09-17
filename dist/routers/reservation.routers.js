"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReservationController_1 = require("../controllers/ReservationController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const permission_middleware_1 = require("../middlewares/permission.middleware");
const ReservationPhase2Controller_1 = require("../controllers/ReservationPhase2Controller");
const router = (0, express_1.Router)();
/*
|--------------------------------------------------------------------------
| PUBLIC RESERVATION
|--------------------------------------------------------------------------
*/
router.post("/availability", ReservationPhase2Controller_1.checkAvailability);
router.post("/otp/request", ReservationPhase2Controller_1.requestReservationOtp);
router.post("/online", ReservationPhase2Controller_1.createOnlineReservation);
router.post("/phone", auth_middleware_1.authMiddleware, permission_middleware_1.requireBranchManager, ReservationPhase2Controller_1.createPhoneReservation);
/*
|--------------------------------------------------------------------------
| ADMIN / MANAGEMENT
|--------------------------------------------------------------------------
*/
// Admin + chain_manager + branch_manager
router.get("/admin", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.getAllReservationsAdmin);
/*
|--------------------------------------------------------------------------
| USER
|--------------------------------------------------------------------------
*/
router.get("/", auth_middleware_1.authMiddleware, ReservationController_1.getMyReservations);
/*
|--------------------------------------------------------------------------
| CREATE
|--------------------------------------------------------------------------
*/
router.post("/", ReservationController_1.createReservation);
/*
|--------------------------------------------------------------------------
| UPDATE / CANCEL
|--------------------------------------------------------------------------
*/
router.put("/:id/cancel", auth_middleware_1.authMiddleware, ReservationController_1.cancelReservation);
router.put("/:id", auth_middleware_1.authMiddleware, ReservationController_1.updateReservation);
/*
|--------------------------------------------------------------------------
| GET BY ID
|--------------------------------------------------------------------------
*/
router.get("/:id", auth_middleware_1.authMiddleware, ReservationController_1.getReservationById);
/*
|--------------------------------------------------------------------------
| DELETE
|--------------------------------------------------------------------------
*/
router.delete("/:id", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.deleteReservation);
exports.default = router;
