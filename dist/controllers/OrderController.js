"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrderStatus = exports.getOrderById = exports.getOrders = exports.createOrder = void 0;
// Tạo đơn gọi món
const createOrder = (req, res) => {
    const { tableId, items } = req.body;
    res.json({
        message: "Order created",
        data: { tableId, items },
    });
};
exports.createOrder = createOrder;
// Lấy danh sách đơn
const getOrders = (req, res) => {
    res.json({
        orders: [],
    });
};
exports.getOrders = getOrders;
// Lấy chi tiết đơn
const getOrderById = (req, res) => {
    const { id } = req.params;
    res.json({
        orderId: id,
    });
};
exports.getOrderById = getOrderById;
// Cập nhật trạng thái đơn
const updateOrderStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    res.json({
        message: "Order status updated",
        orderId: id,
        status,
    });
};
exports.updateOrderStatus = updateOrderStatus;
