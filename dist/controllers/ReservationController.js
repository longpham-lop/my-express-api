"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteReservation = exports.updateReservation = exports.cancelReservation = exports.getReservationById = exports.getAllReservationsAdmin = exports.getMyReservations = exports.createReservation = void 0;
const Reservation_1 = __importDefault(require("../models/Reservation"));
const Table_1 = __importDefault(require("../models/Table"));
const Order_1 = __importDefault(require("../models/Order"));
const OrderItem_1 = __importDefault(require("../models/OrderItem"));
const Branch_1 = __importDefault(require("../models/Branch"));
const sendgrid_1 = __importStar(require("../config/sendgrid"));
const socket_1 = require("../socket");
/* =========================================================
   BRANCH MAP
========================================================= */
const branchMap = {
    "1": "Nhà hàng Vị Nhà 86 Ngọc Khánh",
    "2": "Nhà hàng Vị Nhà 67A Phó Đức Chính",
    "3": "Nhà hàng Vị Nhà 10 Khúc Thừa Dụ",
    "4": "Nhà hàng Vị Nhà 19 Nguyễn Văn Huyên",
};
/* =========================================================
   HELPER
========================================================= */
const isManagementRole = (role) => {
    return ["admin", "chain_manager", "branch_manager"].includes(role);
};
/**
 * Kiểm tra user quản lý có được phép thao tác
 * trên reservation thuộc branch này hay không.
 */
const canManageReservation = (user, reservationBranchId) => {
    // Admin và chain_manager quản lý toàn hệ thống
    if (user.role === "admin" || user.role === "chain_manager") {
        return true;
    }
    // Branch manager chỉ được branch của mình
    if (user.role === "branch_manager") {
        return (user.branchId !== null &&
            reservationBranchId === user.branchId);
    }
    return false;
};
/* =========================================================
   CREATE RESERVATION
========================================================= */
const createReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { table_id, reservation_time, name, phone, email, branch, note, cart, guest_count, } = req.body;
        /* ================= VALIDATE ================= */
        if (!table_id ||
            !reservation_time ||
            !name ||
            !phone ||
            !email) {
            return res.status(400).json({
                message: "Thiếu dữ liệu",
            });
        }
        const reservationDateTime = new Date(reservation_time);
        if (Number.isNaN(reservationDateTime.getTime())) {
            return res.status(400).json({
                message: "Thời gian đặt bàn không hợp lệ",
            });
        }
        /* ================= CHECK TABLE ================= */
        const table = yield Table_1.default.findByPk(table_id);
        if (!table) {
            return res.status(404).json({
                message: "Table không tồn tại",
            });
        }
        if (!table.branch_id) {
            return res.status(400).json({
                message: "Bàn chưa được gán chi nhánh",
            });
        }
        /* ================= CHECK BRANCH ================= */
        const branchId = table.branch_id;
        const branchName = branchMap[String(branchId)] ||
            branchMap[String(branch !== null && branch !== void 0 ? branch : "")] ||
            "Không xác định";
        /* ================= CHECK DUPLICATE ================= */
        const existing = yield Reservation_1.default.findOne({
            where: {
                table_id,
                reservation_time: reservationDateTime,
                status: "pending",
            },
        });
        if (existing) {
            return res.status(409).json({
                message: "Bàn đã được đặt thời gian này",
            });
        }
        /* ================= USER ================= */
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        /* ================= CREATE RESERVATION ================= */
        const reservation = yield Reservation_1.default.create({
            branch_id: branchId,
            table_id,
            reservation_time: reservationDateTime,
            customer_name: name,
            phone,
            email,
            branch: String(branchId),
            note,
            guest_count: guest_count !== null && guest_count !== void 0 ? guest_count : 1,
            user_id: userId,
            status: "pending",
        });
        /* ================= SOCKET ================= */
        const io = (0, socket_1.getIO)();
        io.emit("new-reservation", {
            name,
            phone,
            time: reservation_time,
            branchId,
        });
        /* ================= CREATE ORDER ================= */
        let order = null;
        if (Array.isArray(cart) && cart.length > 0) {
            const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
            order = yield Order_1.default.create({
                branch_id: branchId,
                reservation_id: reservation.id,
                user_id: userId !== null && userId !== void 0 ? userId : undefined,
                total_price: total,
                status: "pending",
            });
            const orderItems = cart.map((item) => ({
                order_id: order.id,
                menu_item_id: Number(item.id),
                quantity: Number(item.quantity),
                unit_price: Number(item.price),
            }));
            yield OrderItem_1.default.bulkCreate(orderItems);
        }
        /* ================= SEND EMAIL ================= */
        let notificationStatus = "skipped";
        const dateTimeParts = reservation_time.split(" ");
        const reservationDate = dateTimeParts[0] || reservation_time;
        const reservationTime = dateTimeParts[1] || "";
        const msg = {
            to: email,
            from: process.env.SENDGRID_FROM_EMAIL || "",
            subject: "Xác nhận đặt bàn",
            text: `
Xin chào ${name},

Bạn đã đặt bàn thành công!

📍 Cơ sở: ${branchName}
⏰ Thời gian: ${reservation_time}
📞 SĐT: ${phone}
📅 Ngày: ${reservationDate}
⏰ Giờ: ${reservationTime}

Khi đến nhà hàng, hãy báo tên hoặc số điện thoại cho lễ tân.

Cảm ơn bạn!
      `,
        };
        if ((0, sendgrid_1.isEmailDeliveryConfigured)()) {
            try {
                yield sendgrid_1.default.send(msg);
                notificationStatus = "sent";
            }
            catch (emailError) {
                notificationStatus = "failed";
                const message = emailError instanceof Error
                    ? emailError.message
                    : "Unknown email error";
                console.error("RESERVATION EMAIL FAILED:", message);
            }
        }
        else {
            console.warn("RESERVATION EMAIL SKIPPED: email delivery is not configured");
        }
        /* ================= RESPONSE ================= */
        return res.status(201).json({
            message: "Đặt bàn thành công",
            data: {
                reservation,
                order,
                notificationStatus,
            },
        });
    }
    catch (err) {
        console.error("CREATE RESERVATION ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.createReservation = createReservation;
/* =========================================================
   USER: GET MY RESERVATIONS
========================================================= */
const getMyReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const data = yield Reservation_1.default.findAll({
            where: {
                user_id: req.user.id,
            },
            order: [["reservation_time", "DESC"]],
        });
        return res.json(data);
    }
    catch (err) {
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.getMyReservations = getMyReservations;
/* =========================================================
   ADMIN / MANAGER: GET ALL RESERVATIONS
========================================================= */
const getAllReservationsAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const { role, branchId } = req.user;
        /* ================= CHECK ROLE ================= */
        if (!isManagementRole(role)) {
            return res.status(403).json({
                message: "Bạn không có quyền xem danh sách đặt bàn",
            });
        }
        /* ================= BRANCH MANAGER ================= */
        if (role === "branch_manager" && !branchId) {
            return res.status(403).json({
                message: "Tài khoản chưa được gán chi nhánh",
            });
        }
        /* ================= WHERE ================= */
        const where = {};
        if (role === "branch_manager") {
            where.branch_id = branchId;
        }
        /* ================= QUERY ================= */
        const data = yield Reservation_1.default.findAll({
            where,
            include: [
                {
                    model: Table_1.default,
                    attributes: [
                        "id",
                        "name",
                        "capacity",
                    ],
                },
                {
                    model: Branch_1.default,
                    as: "restaurantBranch",
                    attributes: [
                        "id",
                        "name",
                        "code",
                    ],
                },
            ],
            order: [["reservation_time", "DESC"]],
        });
        return res.json(data);
    }
    catch (err) {
        console.error("GET ADMIN RESERVATION ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.getAllReservationsAdmin = getAllReservationsAdmin;
/* =========================================================
   GET RESERVATION BY ID
========================================================= */
const getReservationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        const reservation = yield Reservation_1.default.findByPk(id);
        if (!reservation) {
            return res.status(404).json({
                message: "Reservation không tồn tại",
            });
        }
        const { role, branchId } = req.user;
        /* ================= MANAGEMENT ================= */
        if (isManagementRole(role)) {
            if (role === "branch_manager" &&
                branchId !== reservation.branch_id) {
                return res.status(403).json({
                    message: "Bạn không có quyền xem reservation của chi nhánh khác",
                });
            }
            return res.json(reservation);
        }
        /* ================= NORMAL USER ================= */
        if (reservation.user_id !== req.user.id) {
            return res.status(403).json({
                message: "Bạn không có quyền xem reservation này",
            });
        }
        return res.json(reservation);
    }
    catch (err) {
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.getReservationById = getReservationById;
/* =========================================================
   CANCEL RESERVATION
========================================================= */
const cancelReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        const reservation = yield Reservation_1.default.findByPk(id);
        if (!reservation) {
            return res.status(404).json({
                message: "Reservation không tồn tại",
            });
        }
        const { role, branchId } = req.user;
        /* ================= MANAGEMENT ================= */
        if (isManagementRole(role)) {
            if (role === "branch_manager" &&
                branchId !== reservation.branch_id) {
                return res.status(403).json({
                    message: "Bạn không có quyền hủy reservation của chi nhánh khác",
                });
            }
        }
        else {
            /* ================= USER ================= */
            if (reservation.user_id !== req.user.id) {
                return res.status(403).json({
                    message: "Bạn không có quyền hủy reservation này",
                });
            }
        }
        /* ================= CANCEL ================= */
        yield reservation.update({
            status: "cancelled",
        });
        /* ================= FREE TABLE ================= */
        const table = yield Table_1.default.findByPk(reservation.table_id);
        if (table) {
            yield table.update({
                status: "available",
            });
        }
        return res.json({
            message: "Đã hủy đặt bàn",
        });
    }
    catch (err) {
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.cancelReservation = cancelReservation;
/* =========================================================
   UPDATE RESERVATION
========================================================= */
const updateReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        const { table_id, reservation_time, status, } = req.body;
        const reservation = yield Reservation_1.default.findByPk(id);
        if (!reservation) {
            return res.status(404).json({
                message: "Reservation không tồn tại",
            });
        }
        const { role, branchId } = req.user;
        /* ================= CHECK PERMISSION ================= */
        if (isManagementRole(role)) {
            if (role === "branch_manager" &&
                branchId !== reservation.branch_id) {
                return res.status(403).json({
                    message: "Bạn không có quyền sửa reservation của chi nhánh khác",
                });
            }
        }
        else {
            if (reservation.user_id !== req.user.id) {
                return res.status(403).json({
                    message: "Bạn không có quyền sửa reservation này",
                });
            }
        }
        /* ================= CHECK NEW TABLE ================= */
        let newTable = null;
        if (table_id !== undefined) {
            newTable = yield Table_1.default.findByPk(table_id);
            if (!newTable) {
                return res.status(404).json({
                    message: "Bàn mới không tồn tại",
                });
            }
            if (!newTable.branch_id) {
                return res.status(400).json({
                    message: "Bàn mới chưa được gán chi nhánh",
                });
            }
            /*
             * Branch manager không được chuyển
             * reservation sang chi nhánh khác.
             */
            if (role === "branch_manager" &&
                newTable.branch_id !== branchId) {
                return res.status(403).json({
                    message: "Không thể chuyển reservation sang chi nhánh khác",
                });
            }
            /*
             * Với reservation hiện tại,
             * không cho phép đổi sang branch khác.
             */
            if (reservation.branch_id !== null &&
                newTable.branch_id !== reservation.branch_id) {
                return res.status(400).json({
                    message: "Bàn mới phải thuộc cùng chi nhánh",
                });
            }
        }
        /* ================= UPDATE ================= */
        const newReservationTime = reservation_time !== undefined
            ? new Date(reservation_time)
            : reservation.reservation_time;
        if (Number.isNaN(newReservationTime.getTime())) {
            return res.status(400).json({
                message: "Thời gian đặt bàn không hợp lệ",
            });
        }
        yield reservation.update({
            table_id: table_id !== null && table_id !== void 0 ? table_id : reservation.table_id,
            reservation_time: newReservationTime,
            status: status !== null && status !== void 0 ? status : reservation.status,
        });
        return res.json({
            message: "Cập nhật thành công",
            data: reservation,
        });
    }
    catch (err) {
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.updateReservation = updateReservation;
/* =========================================================
   DELETE RESERVATION
========================================================= */
const deleteReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const id = Number(req.params.id);
        if (!id || Number.isNaN(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        /* ================= FIND RESERVATION ================= */
        const reservation = yield Reservation_1.default.findByPk(id);
        if (!reservation) {
            return res.status(404).json({
                message: "Reservation không tồn tại",
            });
        }
        const { role, branchId } = req.user;
        /* ================= ROLE ================= */
        if (!isManagementRole(role)) {
            return res.status(403).json({
                message: "Bạn không có quyền xóa reservation",
            });
        }
        /* ================= BRANCH ISOLATION ================= */
        if (role === "branch_manager" &&
            branchId !== reservation.branch_id) {
            return res.status(403).json({
                message: "Bạn không có quyền xóa reservation của chi nhánh khác",
            });
        }
        /* ================= DELETE ================= */
        yield reservation.destroy();
        return res.json({
            message: "Xóa thành công",
        });
    }
    catch (err) {
        const message = err instanceof Error
            ? err.message
            : "Unknown server error";
        return res.status(500).json({
            message: "Lỗi server",
            error: message,
        });
    }
});
exports.deleteReservation = deleteReservation;
