"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = require("../controllers/AuthController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Đăng nhập
router.post("/login", AuthController_1.login);
// Đổi mật khẩu khi đã đăng nhập
router.post("/change-password", auth_middleware_1.authMiddleware, AuthController_1.changePassword);
// Đổi mật khẩu khi chưa đăng nhập
router.post("/change-password-from-login", AuthController_1.changePasswordFromLogin);
exports.default = router;
