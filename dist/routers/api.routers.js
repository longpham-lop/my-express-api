"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_routers_1 = __importDefault(require("./auth.routers"));
const table_routers_1 = __importDefault(require("./table.routers"));
const menu_routers_1 = __importDefault(require("./menu.routers"));
const order_routers_1 = __importDefault(require("./order.routers"));
const reservation_routers_1 = __importDefault(require("./reservation.routers"));
const router = (0, express_1.Router)();
router.use("/auth", auth_routers_1.default);
router.use("/tables", table_routers_1.default);
router.use("/menu", menu_routers_1.default);
router.use("/orders", order_routers_1.default);
router.use("/reservations", reservation_routers_1.default);
exports.default = router;
