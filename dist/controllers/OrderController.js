"use strict";
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
exports.getMyOrders = exports.deleteOrder = exports.updateOrderStatus = exports.createOrder = exports.getOrderById = exports.getOrderDetail = exports.getAllOrders = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const Reservation_1 = __importDefault(require("../models/Reservation"));
const OrderItem_1 = __importDefault(require("../models/OrderItem"));
const Menu_1 = __importDefault(require("../models/Menu"));
const Table_1 = __importDefault(require("../models/Table"));
/**
 * GET /api/orders
 * - ADMIN: xem tất cả orders
 * - USER: chỉ xem orders của chính mình
 */
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        // ADMIN
        if (req.user.role === "admin") {
            const orders = yield Order_1.default.findAll({
                where: { is_deleted: false },
                order: [["createdAt", "DESC"]],
                include: [
                    {
                        model: OrderItem_1.default,
                        as: "items",
                        include: [
                            {
                                model: Menu_1.default,
                                as: "menu",
                                attributes: ["name", "price", "image"],
                            },
                        ],
                    },
                ],
            });
            return res.json(orders);
        }
        // USER
        const orders = yield Order_1.default.findAll({
            where: { user_id: req.user.id },
            order: [["createdAt", "DESC"]],
        });
        res.json(orders);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getAllOrders = getAllOrders;
/**
 * GET /api/orders/:id
 * - ADMIN: xem bất kỳ order nào
 * - USER: chỉ xem order của mình
 */
const getOrderDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const order = yield Order_1.default.findByPk(id, {
            include: [
                {
                    model: OrderItem_1.default,
                    as: "items",
                    include: [
                        {
                            model: Menu_1.default,
                            as: "menu",
                            attributes: ["name", "price", "image"],
                        },
                    ],
                },
            ],
        });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }
        res.json(order);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
exports.getOrderDetail = getOrderDetail;
const getOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "ID không hợp lệ" });
        }
        const order = yield Order_1.default.findByPk(id, {
            include: [
                {
                    model: OrderItem_1.default,
                    as: "items",
                    include: [
                        {
                            model: Menu_1.default,
                            as: "menu",
                            attributes: ["name", "price", "image"],
                        },
                    ],
                },
            ],
        });
        // ✅ FIX 1: check null trước
        if (!order) {
            return res.status(404).json({ message: "Order không tồn tại" });
        }
        // ✅ FIX 2: sau đó mới check quyền
        if (req.user.role !== "admin" && order.user_id !== req.user.id) {
            return res.status(403).json({ message: "Forbidden" });
        }
        return res.json(order);
    }
    catch (err) {
        if (err instanceof Error) {
            return res.status(500).json({ error: err.message });
        }
        return res.status(500).json({ error: "Unknown error" });
    }
});
exports.getOrderById = getOrderById;
/**
 * POST /api/orders
 * - USER: tạo order cho chính mình
 * - ADMIN: cũng có thể tạo (nếu muốn)
 */
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { reservation_id, total_price } = req.body;
        if (!total_price) {
            return res.status(400).json({ message: "total_price là bắt buộc" });
        }
        const order = yield Order_1.default.create({
            user_id: req.user.id,
            reservation_id: reservation_id || null,
            total_price,
            status: "pending",
        });
        res.status(201).json(order);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createOrder = createOrder;
/**
 * PUT /api/orders/:id/status
 * - CHỈ ADMIN được đổi trạng thái
 */
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "ID không hợp lệ" });
        }
        const { status } = req.body;
        const order = yield Order_1.default.findByPk(id);
        if (!order) {
            return res.status(404).json({ message: "Order không tồn tại" });
        }
        yield order.update({ status });
        // ✅ update reservation theo order
        if (order.reservation_id) {
            const reservation = yield Reservation_1.default.findByPk(order.reservation_id);
            if (reservation) {
                let reservationStatus = reservation.status;
                if (status === "processing") {
                    reservationStatus = "confirmed";
                }
                if (status === "completed") {
                    reservationStatus = "completed";
                }
                yield reservation.update({ status: reservationStatus });
            }
            if (status === "completed" && reservation) {
                const table = yield Table_1.default.findByPk(reservation.table_id);
                if (table) {
                    yield table.update({ status: "available" });
                }
            }
        }
        return res.json({ message: "Cập nhật thành công", order });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateOrderStatus = updateOrderStatus;
/**
 * DELETE /api/orders/:id
 * - CHỈ ADMIN
 */
const deleteOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user || req.user.role !== "admin") {
            return res.status(403).json({ message: "Admin only" });
        }
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "ID không hợp lệ" });
        }
        const order = yield Order_1.default.findByPk(id);
        if (!order) {
            return res.status(404).json({ message: "Order không tồn tại" });
        }
        yield order.update({ is_deleted: true });
        res.json({ message: "Xóa order thành công" });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.deleteOrder = deleteOrder;
// GET /orders/my
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const orders = yield Order_1.default.findAll({
        where: { user_id: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id },
    });
    res.json(orders);
});
exports.getMyOrders = getMyOrders;
