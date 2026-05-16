"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const OrderController_1 = require("../controllers/OrderController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authMiddleware);
router.get("/", OrderController_1.getAllOrders);
router.get("/orders/:id", OrderController_1.getOrderDetail); // /api/orders
router.get("/my", OrderController_1.getMyOrders); // /api/orders/my
router.get("/:id", OrderController_1.getOrderById); // /api/orders/:id
router.post("/", OrderController_1.createOrder); // create
router.put("/:id/status", OrderController_1.updateOrderStatus);
router.delete("/:id", OrderController_1.deleteOrder);
exports.default = router;
