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
const Table_1 = __importDefault(require("../models/Table"));
const Branch_1 = __importDefault(require("../models/Branch"));
const GLOBAL_ROLES = ["admin", "chain_manager"];
const ORDER_ROLES = [
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "cashier",
];
const isGlobalRole = (role) => {
    return !!role && GLOBAL_ROLES.includes(role);
};
const canManageOrders = (role) => {
    return !!role && ORDER_ROLES.includes(role);
};
/**
 * Kiểm tra Branch Manager có đang truy cập đúng chi nhánh không.
 */
const canAccessBranch = (role, userBranchId, orderBranchId) => {
    if (isGlobalRole(role)) {
        return true;
    }
    if (role === "branch_manager") {
        return (userBranchId !== null &&
            userBranchId !== undefined &&
            orderBranchId === userBranchId);
    }
    return true;
};
/**
 * GET /api/orders
 *
 * admin / chain_manager:
 *   xem tất cả
 *
 * branch_manager:
 *   chỉ xem order của chi nhánh mình
 *
 * waiter / cashier:
 *   chỉ xem order của chi nhánh mình
 *
 * user:
 *   chỉ xem order của chính mình
 */
const getAllOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const { id, role, branchId } = req.user;
        if (canManageOrders(role)) {
            const whereCondition = {
                is_deleted: false,
            };
            if (!isGlobalRole(role)) {
                if (!branchId) {
                    return res.status(403).json({
                        message: "Tài khoản chưa được gán chi nhánh",
                    });
                }
                whereCondition.branch_id = branchId;
            }
            const orders = yield Order_1.default.findAll({
                where: whereCondition,
                order: [["createdAt", "DESC"]],
                include: [
                    {
                        model: OrderItem_1.default,
                        as: "items",
                        include: [
                            {
                                model: Menu_1.default,
                                as: "menu",
                                attributes: ["id", "name", "price", "image"],
                            },
                        ],
                    },
                    {
                        model: Branch_1.default,
                        as: "branch",
                        attributes: ["id", "name", "code"],
                        required: false,
                    },
                ],
            });
            return res.json(orders);
        }
        /**
         * User/customer:
         * chỉ xem order của chính mình.
         */
        const orders = yield Order_1.default.findAll({
            where: {
                user_id: id,
                is_deleted: false,
            },
            order: [["createdAt", "DESC"]],
            include: [
                {
                    model: OrderItem_1.default,
                    as: "items",
                    include: [
                        {
                            model: Menu_1.default,
                            as: "menu",
                            attributes: ["id", "name", "price", "image"],
                        },
                    ],
                },
                {
                    model: Branch_1.default,
                    as: "branch",
                    attributes: ["id", "name", "code"],
                },
            ],
        });
        return res.json(orders);
    }
    catch (err) {
        console.error("GET ORDERS ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể lấy danh sách đơn hàng";
        return res.status(500).json({
            message,
        });
    }
});
exports.getAllOrders = getAllOrders;
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
        if (isNaN(id)) {
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
                            attributes: ["id", "name", "price", "image"],
                            required: false,
                        },
                    ],
                },
                {
                    model: Branch_1.default,
                    as: "branch",
                    attributes: ["id", "name", "code"],
                },
            ],
        });
        if (!order) {
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        /**
         * Không cho xem order đã soft delete.
         */
        if (order.is_deleted) {
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        /**
         * Admin / Chain Manager
         */
        if (isGlobalRole(req.user.role)) {
            return res.json(order);
        }
        /**
         * Branch Manager / Waiter / Cashier
         */
        if (canManageOrders(req.user.role)) {
            if (!canAccessBranch(req.user.role, req.user.branchId, order.branch_id)) {
                return res.status(403).json({
                    message: "Bạn không có quyền xem order của chi nhánh khác",
                });
            }
            return res.json(order);
        }
        /**
         * User
         */
        if (order.user_id !== req.user.id) {
            return res.status(403).json({
                message: "Bạn không có quyền xem order này",
            });
        }
        return res.json(order);
    }
    catch (err) {
        console.error("GET ORDER DETAIL ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể lấy chi tiết order";
        return res.status(500).json({
            message,
        });
    }
});
exports.getOrderById = getOrderById;
/**
 * GET /api/orders/orders/:id
 *
 * Giữ lại endpoint cũ để tránh phá frontend hiện tại.
 */
const getOrderDetail = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
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
                            attributes: ["id", "name", "price", "image"],
                        },
                    ],
                },
            ],
        });
        if (!order) {
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        return res.json(order);
    }
    catch (err) {
        console.error("GET ORDER DETAIL ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể lấy order";
        return res.status(500).json({
            message,
        });
    }
});
exports.getOrderDetail = getOrderDetail;
/**
 * POST /api/orders
 *
 * Order có reservation:
 *   lấy branch_id từ reservation.
 *
 * Nhân viên:
 *   lấy branch_id từ JWT.
 */
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const { reservation_id, total_price, } = req.body;
        if (total_price === undefined ||
            total_price === null ||
            Number(total_price) < 0) {
            return res.status(400).json({
                message: "total_price không hợp lệ",
            });
        }
        let finalBranchId = null;
        /**
         * Nếu order thuộc reservation,
         * branch lấy trực tiếp từ reservation.
         */
        if (reservation_id) {
            const reservation = yield Reservation_1.default.findByPk(reservation_id);
            if (!reservation) {
                return res.status(404).json({
                    message: "Reservation không tồn tại",
                });
            }
            finalBranchId = (_a = reservation.branch_id) !== null && _a !== void 0 ? _a : null;
        }
        /**
         * Nếu là nhân viên chi nhánh
         * và chưa có branch từ reservation,
         * lấy branch từ JWT.
         */
        const currentBranchId = req.user.branchId;
        if (!finalBranchId && currentBranchId) {
            finalBranchId = currentBranchId;
        }
        /**
         * Nhân viên chi nhánh bắt buộc phải có branch.
         */
        if (canManageOrders(req.user.role) &&
            !isGlobalRole(req.user.role) &&
            !finalBranchId) {
            return res.status(403).json({
                message: "Tài khoản chưa được gán chi nhánh",
            });
        }
        /**
         * Kiểm tra reservation thuộc đúng branch
         * của Branch Manager.
         */
        if (reservation_id &&
            req.user.role === "branch_manager") {
            const reservation = yield Reservation_1.default.findByPk(reservation_id);
            if (!reservation ||
                reservation.branch_id !== req.user.branchId) {
                return res.status(403).json({
                    message: "Bạn không có quyền tạo order cho chi nhánh khác",
                });
            }
        }
        const order = yield Order_1.default.create({
            branch_id: finalBranchId,
            user_id: req.user.id,
            reservation_id: reservation_id || null,
            total_price: Number(total_price),
            status: "pending",
            is_deleted: false,
        });
        return res.status(201).json(order);
    }
    catch (err) {
        console.error("CREATE ORDER ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể tạo order";
        return res.status(500).json({
            message,
        });
    }
});
exports.createOrder = createOrder;
/**
 * PUT /api/orders/:id/status
 */
/**
 * PUT /api/orders/:id/status
 *
 * Quy tắc:
 *
 * pending
 *   ↓
 * processing
 *   ↓
 * completed
 *
 * Không được completed nếu còn món:
 * - pending
 * - cooking
 * - ready
 *
 * Món chỉ được xem là hoàn tất khi:
 * - served
 * - cancelled
 */
const updateOrderStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        /*
         * =====================================================
         * 1. KIỂM TRA ĐĂNG NHẬP
         * =====================================================
         */
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        /*
         * =====================================================
         * 2. KIỂM TRA ID
         * =====================================================
         */
        const id = Number(req.params.id);
        if (!Number.isInteger(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        /*
         * =====================================================
         * 3. KIỂM TRA QUYỀN
         * =====================================================
         */
        if (!canManageOrders(req.user.role)) {
            return res.status(403).json({
                message: "Bạn không có quyền cập nhật order",
            });
        }
        /*
         * =====================================================
         * 4. KIỂM TRA STATUS
         * =====================================================
         */
        const { status } = req.body;
        const allowedStatuses = [
            "pending",
            "processing",
            "completed",
            "cancelled",
        ];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Trạng thái order không hợp lệ",
            });
        }
        /*
         * =====================================================
         * 5. TÌM ORDER
         * =====================================================
         */
        const order = yield Order_1.default.findByPk(id);
        if (!order || order.is_deleted) {
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        /*
         * =====================================================
         * 6. KIỂM TRA CHI NHÁNH
         * =====================================================
         */
        if (!canAccessBranch(req.user.role, req.user.branchId, order.branch_id)) {
            return res.status(403).json({
                message: "Bạn không có quyền cập nhật order của chi nhánh khác",
            });
        }
        /*
         * =====================================================
         * 7. KHÔNG CHO HOÀN THÀNH ORDER KHI MÓN CHƯA XONG
         * =====================================================
         *
         * Đây là phần quan trọng nhất.
         *
         * Phải kiểm tra TRƯỚC khi order.update().
         */
        if (status === "completed") {
            const items = yield OrderItem_1.default.findAll({
                where: {
                    order_id: order.id,
                },
            });
            /*
            * Order phải có ít nhất 1 món
            */
            if (items.length === 0) {
                return res.status(400).json({
                    message: "Không thể hoàn thành đơn hàng khi đơn chưa có món",
                });
            }
            /*
            * Nếu tất cả món đều bị hủy
            * thì Order phải là cancelled,
            * không được chuyển completed.
            */
            const allCancelled = items.every((item) => item.status === "cancelled");
            if (allCancelled) {
                return res.status(400).json({
                    message: "Không thể hoàn thành đơn hàng vì tất cả món đều đã bị hủy",
                });
            }
            /*
            * Tìm món chưa hoàn thành.
            *
            * Chỉ:
            * - served
            * - cancelled
            *
            * mới được coi là hoàn tất.
            */
            const unfinishedItems = items.filter((item) => item.status !== "served" &&
                item.status !== "cancelled");
            if (unfinishedItems.length > 0) {
                return res.status(400).json({
                    message: "Không thể hoàn thành đơn khi vẫn còn món chưa phục vụ",
                });
            }
        }
        /*
         * =====================================================
         * 8. CẬP NHẬT ORDER
         * =====================================================
         */
        yield order.update({
            status,
        });
        /*
         * =====================================================
         * 9. ĐỒNG BỘ RESERVATION
         * =====================================================
         */
        if (order.reservation_id) {
            const reservation = yield Reservation_1.default.findByPk(order.reservation_id);
            if (reservation) {
                let reservationStatus = reservation.status;
                /*
                 * Order bắt đầu xử lý
                 */
                if (status === "processing") {
                    reservationStatus = "confirmed";
                }
                /*
                 * Order hoàn thành
                 */
                if (status === "completed") {
                    reservationStatus = "completed";
                }
                /*
                 * Order bị hủy
                 */
                if (status === "cancelled") {
                    reservationStatus = "cancelled";
                }
                yield reservation.update({
                    status: reservationStatus,
                });
            }
        }
        /*
         * =====================================================
         * 10. TRẢ BÀN VỀ AVAILABLE
         * =====================================================
         *
         * Chỉ xử lý khi Order hoàn thành.
         */
        if (status === "completed" &&
            order.reservation_id) {
            const reservation = yield Reservation_1.default.findByPk(order.reservation_id);
            if (reservation && reservation.table_id) {
                const table = yield Table_1.default.findByPk(reservation.table_id);
                if (table) {
                    yield table.update({
                        status: "available",
                    });
                }
            }
        }
        /*
         * =====================================================
         * 11. RESPONSE
         * =====================================================
         */
        return res.json({
            message: "Cập nhật order thành công",
            order,
        });
    }
    catch (err) {
        console.error("UPDATE ORDER STATUS ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể cập nhật order";
        return res.status(500).json({
            message,
        });
    }
});
exports.updateOrderStatus = updateOrderStatus;
/**
 * DELETE /api/orders/:id
 *
 * Soft delete.
 */
const deleteOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({
                message: "Chưa đăng nhập",
            });
        }
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                message: "ID không hợp lệ",
            });
        }
        /**
         * Chỉ các role quản lý order
         * mới được xóa.
         */
        if (!canManageOrders(req.user.role)) {
            return res.status(403).json({
                message: "Bạn không có quyền xóa order",
            });
        }
        const order = yield Order_1.default.findByPk(id);
        if (!order || order.is_deleted) {
            return res.status(404).json({
                message: "Order không tồn tại",
            });
        }
        /**
         * Kiểm tra branch.
         */
        if (!canAccessBranch(req.user.role, req.user.branchId, order.branch_id)) {
            return res.status(403).json({
                message: "Bạn không có quyền xóa order của chi nhánh khác",
            });
        }
        yield order.update({
            is_deleted: true,
        });
        return res.json({
            message: "Xóa order thành công",
        });
    }
    catch (err) {
        console.error("DELETE ORDER ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể xóa order";
        return res.status(500).json({
            message,
        });
    }
});
exports.deleteOrder = deleteOrder;
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
            order: [["createdAt", "DESC"]],
        });
        return res.json(orders);
    }
    catch (err) {
        console.error("GET MY ORDERS ERROR:", err);
        const message = err instanceof Error
            ? err.message
            : "Không thể lấy order";
        return res.status(500).json({
            message,
        });
    }
});
exports.getMyOrders = getMyOrders;
