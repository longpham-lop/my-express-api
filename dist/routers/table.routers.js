"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TableController_1 = require("../controllers/TableController");
const router = (0, express_1.Router)();
router.get("/", TableController_1.getTables);
router.post("/", TableController_1.createTable);
exports.default = router;
