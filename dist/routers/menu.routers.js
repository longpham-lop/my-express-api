"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MenuController_1 = require("../controllers/MenuController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const role_middleware_1 = require("../middlewares/role.middleware");
const router = (0, express_1.Router)();
router.get("/", MenuController_1.getAllMenuItems); // READ ALL
router.get("/:id", MenuController_1.getMenuItemById); // READ ONE
router.post("/", auth_middleware_1.authMiddleware, role_middleware_1.isAdmin, MenuController_1.createMenuItem); // CREATE
router.put("/:id", auth_middleware_1.authMiddleware, role_middleware_1.isAdmin, MenuController_1.updateMenuItem); // UPDATE
router.delete("/:id", auth_middleware_1.authMiddleware, role_middleware_1.isAdmin, MenuController_1.deleteMenuItem); // DELETE
exports.default = router;
