"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TableController_1 = require("../controllers/TableController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
/**
 * CRUD cấu trúc bàn
 * Admin / Chain Manager / Branch Manager
 */
router.post("/", auth_middleware_1.authMiddleware, role_middleware_1.requireTableManager, TableController_1.createTable);
router.put("/:id", auth_middleware_1.authMiddleware, role_middleware_1.requireTableManager, TableController_1.updateTable);
router.delete("/:id", auth_middleware_1.authMiddleware, role_middleware_1.requireTableManager, TableController_1.deleteTable);
/**
 * Xem bàn
 * Admin / Chain Manager / Branch Manager / Waiter
 */
router.get("/", auth_middleware_1.authMiddleware, TableController_1.getAllTable);
router.get("/:id", auth_middleware_1.authMiddleware, TableController_1.getTableById);
/**
 * Cập nhật trạng thái bàn
 * Hiện tại chỉ manager.
 */
router.put("/:id/status", auth_middleware_1.authMiddleware, role_middleware_1.requireTableManager, TableController_1.updateStatus);
exports.default = router;
