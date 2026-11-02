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
exports.getMyOrders = exports.deleteOrder = exports.updateOrderStatus = exports.createOrder = exports.getOrderDetail = exports.getOrderById = exports.getAllOrders = void 0;
const Order_1 = __importDefault(require("../models/Order"));
const Reservation_1 = __importDefault(require("../models/Reservation"));
const OrderItem_1 = __importDefault(require("../models/OrderItem"));
const Menu_1 = __importDefault(require("../models/Menu"));
const Branch_1 = __importDefault(require("../models/Branch"));
const db_1 = __importDefault(require("../config/db"));
const socket_1 = require("../socket");
/* =====================================================
 * CONSTANTS
 * ===================================================== */
const GLOBAL_ROLES = [
    "admin",
    "chain_manager",
];
const ORDER_ROLES = [
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "cashier",
];
const MANAGER_ROLES = [
    "admin",
    "chain_manager",
    "branch_manager",
];
/* =====================================================
 * ROLE HELPERS
 * ===================================================== */
const isGlobalRole = (role) => {
    return (!!role &&
        GLOBAL_ROLES.includes(role));
};
const canManageOrders = (role) => {
    return (!!role &&
        ORDER_ROLES.includes(role));
};
const isManagerRole = (role) => {
    return (!!role &&
        MANAGER_ROLES.includes(role));
};
/* =====================================================
 * VALIDATION HELPERS
 * ===================================================== */
const isValidPositiveId = (value) => {
    const numberValue = Number(value);
    return (Number.isInteger(numberValue) &&
        numberValue > 0);
};
/* =====================================================
 * BRANCH PERMISSION
 * ===================================================== */
const canAccessBranch = (role, userBranchId, orderBranchId) => {
    if (isGlobalRole(role)) {
        return true;
    }
    if (role !== "branch_manager" &&
        role !== "waiter" &&
        role !== "cashier") {
        return false;
    }
    if (userBranchId == null ||
        orderBranchId == null) {
        return false;
    }
    const currentBranchId = Number(userBranchId);
    const targetBranchId = Number(orderBranchId);
    return (Number.isInteger(currentBranchId) &&
        currentBranchId > 0 &&
        Number.isInteger(targetBranchId) &&
        targetBranchId > 0 &&
        currentBranchId === targetBranchId);
};
/* =====================================================
 * SOCKET HELPER
 * ===================================================== */
/* =====================================================
 * SOCKET HELPER
 * ===================================================== */
const emitOrderUpdated = (orderId, status, branchId) => {
    try {
        const io = (0, socket_1.getIO)();
        const rooms = branchId != null
            ? io.to(`branch:${branchId}`).to("role:global")
            : io.to("role:global");
        rooms.emit("order-status-updated", {
            order_id: orderId,
            status,
        });
        rooms.emit("order-item-status-updated", {
            order_id: orderId,
            status,
        });
    }
    catch (error) {
        console.warn("ORDER SOCKET WARNING:", error);
    }
};
/* =====================================================
 * GET ALL ORDERS
 * ===================================================== */
/**
 * GET /api/orders
 *
 * Admin / Chain Manager:
 * - Xem toàn bộ đơn hàng.
 *
 * Branch Manager / Waiter / Cashier:
 * - Chỉ xem đơn của chi nhánh mình.
 *
 * User / Customer:
 * - Chỉ xem đơn của chính mình.
 */
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const { id, role, branchId, } = req.user;
        if (canManageOrders(role)) {
            const whereCondition = {
                is_deleted: false,
            };
            if (!isGlobalRole(role)) {
                if (branchId == null) {
                    return res.status(403).json({
                        message: "Tài khoản chưa được gán chi nhánh",
                    });
                }
                whereCondition.branch_id =
                    Number(branchId);
            }
            const orders = yield Order_1.default.findAll({
                where: whereCondition,
                order: [
                    ["createdAt", "DESC"],
                ],
                include: [
                    {
                        model: OrderItem_1.default,
                        as: "items",
                        include: [
                            {
                                model: Menu_1.default,
                                as: "menu",
                                attributes: [
                                    "id",
                                    "name",
                                    "price",
                                    "image",
                                ],
                            },
                        ],
                    },
                    {
                        model: Branch_1.default,
                        as: "branch",
                        attributes: [
                            "id",
                            "name",
                            "code",
                        ],
                        required: false,
                    },
                ],
            });
            return res.status(200).json(orders);
        }
        /*
         * Customer chỉ xem đơn của chính mình.
         */
        if (role !== "user" &&
            role !== "customer") {
            return res.status(403).json({
                message: "Bạn không có quyền xem danh sách đơn hàng",
            });
        }
        const orders = yield Order_1.default.findAll({
            where: {
                user_id: id,
                is_deleted: false,
            },
            order: [
                ["createdAt", "DESC"],
            ],
            include: [
                {
                    model: OrderItem_1.default,
                    as: "items",
                    include: [
                        {
                            model: Menu_1.default,
                            as: "menu",
                            attributes: [
                                "id",
                                "name",
                                "price",
                                "image",
                            ],
                        },
                    ],
                },
                {
                    model: Branch_1.default,
                    as: "branch",
                    attributes: [
                        "id",
                        "name",
                        "code",
                    ],
                    required: false,
                },
            ],
        });
        return res.status(200).json(orders);
    }
    catch (error) {
        console.error("GET ORDERS ERROR:", error);
        return res.status(500).json({
            message: error instanceof Error
                ? error.message
                : "Không thể lấy danh sách đơn hàng",
        });
    }
});
exports.getAllOrders = getAllOrders;
/* =====================================================
 * GET ORDER BY ID
 * ===================================================== */
/**
 * GET /api/orders/:id
 */
const getOrderById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const id = Number(req.params.id);
        if (!isValidPositiveId(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
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
                            attributes: [
                                "id",
                                "name",
                                "price",
                                "image",
                            ],
                            required: false,
                        },
                    ],
                },
                {
                    model: Branch_1.default,
                    as: "branch",
                    attributes: [
                        "id",
                        "name",
                        "code",
                    ],
                    required: false,
                },
            ],
        });
        if (!order || order.is_deleted) {
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        const role = req.user.role;
        if (isGlobalRole(role)) {
            return res.status(200).json(order);
        }
        if (canManageOrders(role)) {
            const allowed = canAccessBranch(role, req.user.branchId, order.branch_id);
            if (!allowed) {
                return res.status(403).json({
                    message: "Bạn không có quyền xem Order của chi nhánh khác",
                });
            }
            return res.status(200).json(order);
        }
        if (role !== "user" &&
            role !== "customer") {
            return res.status(403).json({
                message: "Bạn không có quyền xem Order này",
            });
        }
        if (Number(order.user_id) !==
            Number(req.user.id)) {
            return res.status(403).json({
                message: "Bạn không có quyền xem Order của người khác",
            });
        }
        return res.status(200).json(order);
    }
    catch (error) {
        console.error("GET ORDER DETAIL ERROR:", error);
        return res.status(500).json({
            message: error instanceof Error
                ? error.message
                : "Không thể lấy chi tiết Order",
        });
    }
});
exports.getOrderById = getOrderById;
/*
 * Tương thích với endpoint cũ.
 *
 * Endpoint cũ vẫn phải gắn authMiddleware.
 */
exports.getOrderDetail = exports.getOrderById;
/* =====================================================
 * CREATE ORDER
 * ===================================================== */
/**
 * POST /api/orders
 *
 * Nếu có reservation_id:
 * - Lấy branch_id từ Reservation.
 *
 * Nếu là nhân viên chi nhánh:
 * - Lấy branch_id từ JWT.
 *
 * total_price luôn bắt đầu bằng 0.
 * Backend sẽ tính lại khi thêm OrderItem.
 */
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const reservationId = req.body.reservation_id;
        if (reservationId != null &&
            !isValidPositiveId(reservationId)) {
            return res.status(400).json({
                message: "Reservation ID không hợp lệ",
            });
        }
        let finalBranchId = null;
        let reservation = null;
        if (reservationId != null) {
            reservation =
                yield Reservation_1.default.findByPk(Number(reservationId));
            if (!reservation) {
                return res.status(404).json({
                    message: "Reservation không tồn tại",
                });
            }
            finalBranchId =
                (_a = reservation.branch_id) !== null && _a !== void 0 ? _a : null;
        }
        const role = req.user.role;
        /*
         * Nhân viên chi nhánh phải sử dụng
         * Reservation thuộc đúng chi nhánh.
         */
        if (reservation &&
            canManageOrders(role) &&
            !isGlobalRole(role)) {
            if (req.user.branchId == null ||
                Number(reservation.branch_id) !==
                    Number(req.user.branchId)) {
                return res.status(403).json({
                    message: "Bạn không có quyền tạo Order cho Reservation thuộc chi nhánh khác",
                });
            }
        }
        /*
         * Nếu chưa lấy được branch từ Reservation,
         * sử dụng branch trong JWT.
         */
        if (finalBranchId == null &&
            req.user.branchId != null) {
            finalBranchId =
                Number(req.user.branchId);
        }
        /*
         * Nhân viên chi nhánh bắt buộc có branch.
         */
        if (canManageOrders(role) &&
            !isGlobalRole(role) &&
            finalBranchId == null) {
            return res.status(403).json({
                message: "Tài khoản chưa được gán chi nhánh",
            });
        }
        const order = yield Order_1.default.create({
            branch_id: finalBranchId,
            user_id: req.user.id,
            reservation_id: (_b = reservation === null || reservation === void 0 ? void 0 : reservation.id) !== null && _b !== void 0 ? _b : null,
            total_price: 0,
            status: "pending",
            is_deleted: false,
        });
        emitOrderUpdated(order.id, order.status, order.branch_id);
        return res.status(201).json({
            message: "Tạo Order thành công",
            data: order,
        });
    }
    catch (error) {
        console.error("CREATE ORDER ERROR:", error);
        return res.status(500).json({
            message: error instanceof Error
                ? error.message
                : "Không thể tạo Order",
        });
    }
});
exports.createOrder = createOrder;
/* =====================================================
 * UPDATE ORDER STATUS
 * ===================================================== */
/**
 * PUT /api/orders/:id/status
 *
 * API này chỉ cho phép hủy Order.
 *
 * processing và completed được đồng bộ
 * tự động từ OrderItem.
 */
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({
            message: "Chưa đăng nhập",
        });
    }
    const id = Number(req.params.id);
    if (!isValidPositiveId(id)) {
        return res.status(400).json({
            message: "ID không hợp lệ",
        });
    }
    if (!isManagerRole(req.user.role)) {
        return res.status(403).json({
            message: "Bạn không có quyền hủy Order",
        });
    }
    if (req.body.status !== "cancelled") {
        return res.status(400).json({
            message: "Trạng thái Order được đồng bộ tự động. API này chỉ hỗ trợ hủy Order.",
        });
    }
    const transaction = yield db_1.default.transaction();
    try {
        const order = yield Order_1.default.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!order || order.is_deleted) {
            yield transaction.rollback();
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        if (!canAccessBranch(req.user.role, req.user.branchId, order.branch_id)) {
            yield transaction.rollback();
            return res.status(403).json({
                message: "Bạn không có quyền hủy Order của chi nhánh khác",
            });
        }
        if (order.status === "completed" ||
            order.status === "cancelled") {
            yield transaction.rollback();
            return res.status(400).json({
                message: "Không thể hủy Order đã hoàn tất hoặc đã hủy",
            });
        }
        const items = yield OrderItem_1.default.findAll({
            where: {
                order_id: order.id,
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        /*
         * Không cho hủy toàn bộ đơn
         * nếu đã có món được phục vụ.
         */
        const hasServedItem = items.some((item) => item.status === "served");
        if (hasServedItem) {
            yield transaction.rollback();
            return res.status(400).json({
                message: "Order đã có món được phục vụ. Không thể hủy toàn bộ Order.",
            });
        }
        /*
         * Chuyển tất cả món chưa phục vụ
         * sang trạng thái cancelled.
         */
        for (const item of items) {
            if (item.status !== "cancelled") {
                yield item.update({
                    status: "cancelled",
                }, {
                    transaction,
                });
            }
        }
        yield order.update({
            status: "cancelled",
            total_price: 0,
        }, {
            transaction,
        });
        /*
         * Đồng bộ Reservation.
         */
        if (order.reservation_id) {
            const reservation = yield Reservation_1.default.findByPk(order.reservation_id, {
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            if (reservation) {
                yield reservation.update({
                    status: "cancelled",
                }, {
                    transaction,
                });
            }
        }
        yield transaction.commit();
        emitOrderUpdated(order.id, "cancelled", order.branch_id);
        return res.status(200).json({
            message: "Hủy Order thành công",
            order: {
                id: order.id,
                status: "cancelled",
                total_price: 0,
            },
        });
    }
    catch (error) {
        try {
            yield transaction.rollback();
        }
        catch (_a) {
            // Transaction có thể đã kết thúc.
        }
        console.error("UPDATE ORDER STATUS ERROR:", error);
        return res.status(500).json({
            message: error instanceof Error
                ? error.message
                : "Không thể hủy Order",
        });
    }
});
exports.updateOrderStatus = updateOrderStatus;
/* =====================================================
 * DELETE ORDER
 * ===================================================== */
/**
 * DELETE /api/orders/:id
 *
 * Chỉ cho phép quản lý.
 * Chỉ xóa mềm đơn đã hoàn thành hoặc đã hủy.
 */
const deleteOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.user) {
        return res.status(401).json({
            message: "Chưa đăng nhập",
        });
    }
    const id = Number(req.params.id);
    if (!isValidPositiveId(id)) {
        return res.status(400).json({
            message: "ID không hợp lệ",
        });
    }
    if (!isManagerRole(req.user.role)) {
        return res.status(403).json({
            message: "Bạn không có quyền xóa Order",
        });
    }
    const transaction = yield db_1.default.transaction();
    try {
        const order = yield Order_1.default.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!order || order.is_deleted) {
            yield transaction.rollback();
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        if (!canAccessBranch(req.user.role, req.user.branchId, order.branch_id)) {
            yield transaction.rollback();
            return res.status(403).json({
                message: "Bạn không có quyền xóa Order của chi nhánh khác",
            });
        }
        if (order.status !== "completed" &&
            order.status !== "cancelled") {
            yield transaction.rollback();
            return res.status(400).json({
                message: "Chỉ được xóa Order đã hoàn thành hoặc đã hủy",
            });
        }
        yield order.update({
            is_deleted: true,
        }, {
            transaction,
        });
        yield transaction.commit();
        emitOrderUpdated(order.id, order.status, order.branch_id);
        return res.status(200).json({
            message: "Xóa Order thành công",
        });
    }
    catch (error) {
        try {
            yield transaction.rollback();
        }
        catch (_a) {
            // Transaction có thể đã kết thúc.
        }
        console.error("DELETE ORDER ERROR:", error);
        return res.status(500).json({
            message: error instanceof Error
                ? error.message
                : "Không thể xóa Order",
        });
    }
});
exports.deleteOrder = deleteOrder;
/* =====================================================
 * GET MY ORDERS
 * ===================================================== */
/**
 * GET /api/orders/my
 */
const getMyOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const orders = yield Order_1.default.findAll({
            where: {
                user_id: req.user.id,
                is_deleted: false,
            },
            order: [
                ["createdAt", "DESC"],
            ],
            include: [
                {
                    model: OrderItem_1.default,
                    as: "items",
                    include: [
                        {
                            model: Menu_1.default,
                            as: "menu",
                            attributes: [
                                "id",
                                "name",
                                "price",
                                "image",
                            ],
                        },
                    ],
                },
            ],
        });
        return res.status(200).json(orders);
    }
    catch (error) {
        console.error("GET MY ORDERS ERROR:", error);
        return res.status(500).json({
            message: error instanceof Error
                ? error.message
                : "Không thể lấy danh sách Order",
        });
    }
});
exports.getMyOrders = getMyOrders;
