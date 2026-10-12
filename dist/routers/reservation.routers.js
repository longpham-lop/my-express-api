"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ReservationController_1 = require("../controllers/ReservationController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
/*
 * =========================================================
 * CUSTOMER / USER
 * =========================================================
 */
router.post("/availability", ReservationController_1.checkReservationAvailability);
// Tạo đặt bàn
router.post("/", ReservationController_1.createReservation);
router.post("/otp/request", ReservationController_1.requestReservationOtp);
router.post("/online", ReservationController_1.createOnlineReservation);
// Xem đặt bàn của chính mình
router.get("/my", auth_middleware_1.authMiddleware, ReservationController_1.getMyReservations);
/*
 * =========================================================
 * ADMIN
 * =========================================================
 */
// Danh sách tất cả reservation
router.get("/admin", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager", "waiter"), ReservationController_1.getAllReservationsAdmin);
// Chi tiết
router.get("/:id", auth_middleware_1.authMiddleware, ReservationController_1.getReservationById);
// Cập nhật thông tin
router.put("/:id", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.updateReservation);
// Xác nhận
router.put("/:id/confirm", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.confirmReservation);
// Check-in
router.put("/:id/check-in", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.checkInReservation);
// Hoàn tất
router.put("/:id/complete", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.completeReservation);
// Hủy
router.put("/:id/cancel", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.cancelReservation);
// Xóa
router.delete("/:id", auth_middleware_1.authMiddleware, (0, role_middleware_1.requireRole)("admin", "chain_manager", "branch_manager"), ReservationController_1.deleteReservation);
exports.default = router;
