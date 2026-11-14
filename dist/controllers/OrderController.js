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
const sequelize_1 = require("sequelize");
const StaffBranch_1 = __importDefault(require("../models/StaffBranch"));
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
/**
 * Kiểm tra quyền truy cập một chi nhánh.
 *
 * Admin: tất cả chi nhánh.
 * Chain Manager: chi nhánh được phân công và đang hoạt động.
 * Nhân viên chi nhánh: chi nhánh trong JWT.
 */
const canAccessBranch = (role, userId, userBranchId, targetBranchId) => __awaiter(void 0, void 0, void 0, function* () {
    if (targetBranchId == null ||
        !isValidPositiveId(targetBranchId)) {
        return false;
    }
    if (role === "admin") {
        return true;
    }
    if (role === "chain_manager") {
        const assignment = yield StaffBranch_1.default.findOne({
            where: {
                user_id: userId,
                branch_id: Number(targetBranchId),
                is_active: true,
            },
        });
        return assignment !== null;
    }
    if (role !== "branch_manager" &&
        role !== "waiter" &&
        role !== "cashier") {
        return false;
    }
    if (userBranchId == null) {
        return false;
    }
    return (Number.isInteger(Number(userBranchId)) &&
        Number(userBranchId) > 0 &&
        Number(userBranchId) === Number(targetBranchId));
});
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
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const { id, role, branchId, } = req.user;
        // Kiểm tra quyền truy cập danh sách đơn hàng.
        if (canManageOrders(role)) {
            const whereCondition = {
                is_deleted: false,
            };
            // ADMIN: Xem toàn bộ chi nhánh.
            if (role === "admin") {
                // Không cần thêm điều kiện branch_id.
            }
            // CHAIN MANAGER: Chỉ xem chi nhánh được phân công.
            else if (role === "chain_manager") {
                const assignments = yield StaffBranch_1.default.findAll({
                    where: {
                        user_id: id,
                        is_active: true,
                    },
                    attributes: ["branch_id"],
                });
                const branchIds = [
                    ...new Set(assignments.map((item) => item.branch_id)),
                ];
                if (branchIds.length === 0) {
                    return res.status(200).json([]);
                }
                whereCondition.branch_id = {
                    [sequelize_1.Op.in]: branchIds,
                };
            }
            // BRANCH MANAGER / WAITER / CASHIER.
            else {
                if (branchId == null) {
                    return res.status(403).json({
                        message: "Tài khoản chưa được gán chi nhánh",
                    });
                }
                whereCondition.branch_id = Number(branchId);
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
        // USER / CUSTOMER: Chỉ xem đơn của chính mình.
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
        if (role === "admin") {
            return res.status(200).json(order);
        }
        if (canManageOrders(role)) {
            const allowed = yield canAccessBranch(role, req.user.id, req.user.branchId, order.branch_id);
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
/* =====================================================
 * CREATE ORDER
 * ===================================================== */
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const { id: userId, role, branchId: userBranchId, } = req.user;
        const reservationId = req.body.reservation_id;
        const requestedBranchId = req.body.branch_id;
        // Validate Reservation ID.
        if (reservationId != null &&
            !isValidPositiveId(reservationId)) {
            return res.status(400).json({
                message: "Reservation ID không hợp lệ",
            });
        }
        // Validate branch_id nếu client có gửi.
        if (requestedBranchId != null &&
            !isValidPositiveId(requestedBranchId)) {
            return res.status(400).json({
                message: "Branch ID không hợp lệ",
            });
        }
        let reservation = null;
        let finalBranchId = null;
        // BƯỚC 1: Nếu có Reservation, lấy chi nhánh từ Reservation.
        if (reservationId != null) {
            reservation = yield Reservation_1.default.findByPk(Number(reservationId));
            if (!reservation) {
                return res.status(404).json({
                    message: "Reservation không tồn tại",
                });
            }
            if (reservation.branch_id == null) {
                return res.status(400).json({
                    message: "Reservation chưa được gán chi nhánh",
                });
            }
            finalBranchId = Number(reservation.branch_id);
        }
        // BƯỚC 2: Nếu không có Reservation, xác định chi nhánh.
        else {
            if (role === "admin" || role === "chain_manager") {
                // Admin và Chain Manager phải chọn chi nhánh.
                if (requestedBranchId == null) {
                    return res.status(400).json({
                        message: "Vui lòng chọn chi nhánh để tạo đơn",
                    });
                }
                finalBranchId = Number(requestedBranchId);
            }
            else if (role === "branch_manager" ||
                role === "waiter" ||
                role === "cashier") {
                // Nhân viên chi nhánh chỉ sử dụng chi nhánh trong JWT.
                if (userBranchId == null) {
                    return res.status(403).json({
                        message: "Tài khoản chưa được gán chi nhánh",
                    });
                }
                finalBranchId = Number(userBranchId);
            }
            else if (role === "user" ||
                role === "customer") {
                // Khách hàng phải chọn chi nhánh.
                if (requestedBranchId == null) {
                    return res.status(400).json({
                        message: "Vui lòng chọn chi nhánh",
                    });
                }
                finalBranchId = Number(requestedBranchId);
            }
            else {
                return res.status(403).json({
                    message: "Bạn không có quyền tạo Order",
                });
            }
        }
        // BƯỚC 3: Kiểm tra chi nhánh tồn tại.
        const branch = yield Branch_1.default.findByPk(finalBranchId);
        if (!branch) {
            return res.status(404).json({
                message: "Chi nhánh không tồn tại",
            });
        }
        // BƯỚC 4: Kiểm tra quyền truy cập chi nhánh.
        if (canManageOrders(role)) {
            const allowed = yield canAccessBranch(role, userId, userBranchId, finalBranchId);
            if (!allowed) {
                return res.status(403).json({
                    message: "Bạn không được phân công hoặc không có quyền thao tác tại chi nhánh này",
                });
            }
        }
        // BƯỚC 5: Tạo đơn hàng.
        const order = yield Order_1.default.create({
            branch_id: finalBranchId,
            user_id: userId,
            reservation_id: (_a = reservation === null || reservation === void 0 ? void 0 : reservation.id) !== null && _a !== void 0 ? _a : null,
            total_price: 0,
            status: "pending",
            is_deleted: false,
        });
        // BƯỚC 6: Thông báo Socket.IO.
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
    var _a;
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
        const allowed = yield canAccessBranch(req.user.role, req.user.id, req.user.branchId, order.branch_id);
        if (!allowed) {
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
        emitOrderUpdated(order.id, "cancelled", (_a = order.branch_id) !== null && _a !== void 0 ? _a : null);
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
        catch (_b) {
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
    var _a;
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
        const allowed = yield canAccessBranch(req.user.role, req.user.id, req.user.branchId, order.branch_id);
        if (!allowed) {
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
        emitOrderUpdated(order.id, order.status, (_a = order.branch_id) !== null && _a !== void 0 ? _a : null);
        return res.status(200).json({
            message: "Xóa Order thành công",
        });
    }
    catch (error) {
        try {
            yield transaction.rollback();
        }
        catch (_b) {
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
