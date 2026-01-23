"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MenuController_1 = require("../controllers/MenuController");
const router = (0, express_1.Router)();
// /api/menu
router.get("/", MenuController_1.getMenu);
router.get("/:id", MenuController_1.getMenuItemById);
router.post("/", MenuController_1.createMenuItem);
router.put("/:id", MenuController_1.updateMenuItem);
router.delete("/:id", MenuController_1.deleteMenuItem);
exports.default = router;
