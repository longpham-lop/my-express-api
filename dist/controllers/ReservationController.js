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
const branchMap = {
    "1": "Nhà hàng Vị Nhà 86 Ngọc Khánh",
    "2": "Nhà hàng Vị Nhà 67A Phó Đức Chính",
    "3": "Nhà hàng Vị Nhà 10 Khúc Thừa Dụ",
    "4": "Nhà hàng Vị Nhà 19 Nguyễn Văn Huyên"
};
/* ================= CREATE ================= */
const createReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { table_id, reservation_time, name, phone, email, // ✅ FIX
        branch, note, cart, guest_count, } = req.body;
        // ✅ Validate
        if (!table_id || !reservation_time || !name || !phone || !email) {
            return res.status(400).json({ message: "Thiếu dữ liệu" });
        }
        // ✅ Check bàn
        const table = yield Table_1.default.findByPk(table_id);
        if (!table) {
            return res.status(404).json({ message: "Table không tồn tại" });
        }
        const branchName = branchMap[branch] || "Không xác định";
        // ✅ Check trùng
        const existing = yield Reservation_1.default.findOne({
            where: {
                table_id,
                reservation_time,
                status: "pending",
            },
        });
        if (existing) {
            return res.status(409).json({
                message: "Bàn đã được đặt thời gian này",
            });
        }
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
        // ✅ Tạo reservation
        const reservation = yield Reservation_1.default.create({
            table_id,
            reservation_time,
            customer_name: name,
            phone,
            email,
            branch,
            note,
            guest_count,
            user_id: userId,
            status: "pending",
        });
        const io = (0, socket_1.getIO)();
        io.emit("new-reservation", {
            name,
            phone,
            time: reservation_time,
        });
        let order = null;
        // ✅ Tạo order nếu có cart
        if (Array.isArray(cart) && cart.length > 0) {
            const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            order = yield Order_1.default.create({
                reservation_id: reservation.id,
                user_id: userId !== null && userId !== void 0 ? userId : undefined,
                total_price: total,
                status: "pending",
            });
            const orderItems = cart.map((item) => ({
                order_id: order.id,
                menu_item_id: Number(item.id),
                quantity: item.quantity,
                unit_price: item.price,
            }));
            yield OrderItem_1.default.bulkCreate(orderItems);
        }
        let notificationStatus = "skipped";
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
        📅 Ngày: ${reservation_time.split(" ")[0]}
        ⏰ Giờ: ${reservation_time.split(" ")[1]}

        Khi đến nhà hàng, hãy báo tên hoặc số điện thoại cho lễ tân. Cảm ơn bạn!
      `,
        };
        if ((0, sendgrid_1.isEmailDeliveryConfigured)()) {
            try {
                yield sendgrid_1.default.send(msg);
                notificationStatus = "sent";
            }
            catch (emailError) {
                // Reservation data has already been saved; email failure must not turn it into a failed reservation.
                notificationStatus = "failed";
                console.error("RESERVATION EMAIL FAILED:", ((_b = emailError.response) === null || _b === void 0 ? void 0 : _b.body) || emailError.message);
            }
        }
        else {
            console.warn("RESERVATION EMAIL SKIPPED: email delivery is not configured");
        }
        // ✅ Response cuối
        return res.status(201).json({
            message: "Đặt bàn thành công",
            data: { reservation, order, notificationStatus },
        });
    }
    catch (err) {
        console.error("CREATE RESERVATION ERROR:", err);
        return res.status(500).json({
            message: "Lỗi server",
            error: err.message,
        });
    }
});
exports.createReservation = createReservation;
/* ================= USER: GET MY ================= */
const getMyReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const data = yield Reservation_1.default.findAll({
            where: { user_id: req.user.id },
            order: [["reservation_time", "DESC"]],
        });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});
exports.getMyReservations = getMyReservations;
/* ================= ADMIN: GET ALL ================= */
const getAllReservationsAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }
        const data = yield Reservation_1.default.findAll({
            include: [
                {
                    model: Table_1.default,
                    attributes: ["id", "name", "capacity"],
                },
                {
                    model: Branch_1.default,
                    as: "restaurantBranch",
                    attributes: ["id", "name", "code"],
                },
            ],
            order: [["reservation_time", "DESC"]],
        });
        res.json(data);
    }
    catch (err) {
        console.error("GET ADMIN RESERVATION ERROR:", err);
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});
exports.getAllReservationsAdmin = getAllReservationsAdmin;
/* ================= GET BY ID ================= */
const getReservationById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
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
        // user chỉ xem của mình
        if (req.user &&
            req.user.role !== "admin" &&
            reservation.user_id !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        res.json(reservation);
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});
exports.getReservationById = getReservationById;
/* ================= CANCEL ================= */
const cancelReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
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
        // check quyền
        if (req.user &&
            req.user.role !== "admin" &&
            reservation.user_id !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        yield reservation.update({ status: "cancelled" });
        // trả bàn
        const table = yield Table_1.default.findByPk(reservation.table_id);
        if (table) {
            yield table.update({ status: "available" });
        }
        res.json({ message: "Đã hủy đặt bàn" });
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});
exports.cancelReservation = cancelReservation;
/* ================= UPDATE ================= */
const updateReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        const { table_id, reservation_time, status } = req.body;
        const reservation = yield Reservation_1.default.findByPk(id);
        if (!reservation) {
            return res.status(404).json({
                message: "Reservation không tồn tại",
            });
        }
        // quyền
        if (req.user &&
            req.user.role !== "admin" &&
            reservation.user_id !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        yield reservation.update({
            table_id: table_id !== null && table_id !== void 0 ? table_id : reservation.table_id,
            reservation_time: reservation_time !== null && reservation_time !== void 0 ? reservation_time : reservation.reservation_time,
            status: status !== null && status !== void 0 ? status : reservation.status,
        });
        res.json({
            message: "Cập nhật thành công",
            data: reservation,
        });
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});
exports.updateReservation = updateReservation;
/* ================= DELETE (ADMIN) ================= */
const deleteReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }
        const id = Number(req.params.id);
        if (!id || isNaN(id)) {
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
        yield reservation.destroy();
        res.json({ message: "Xóa thành công" });
    }
    catch (err) {
        res.status(500).json({ message: "Lỗi server", error: err.message });
    }
});
exports.deleteReservation = deleteReservation;
