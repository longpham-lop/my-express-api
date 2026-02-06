"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = require("../controllers/AuthController");
const router = (0, express_1.Router)();
router.post("/register", AuthController_1.register);
router.post("/login", AuthController_1.login);
// router.post("/logout", logout); 
exports.default = router;
