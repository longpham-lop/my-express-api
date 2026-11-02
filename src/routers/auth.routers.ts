import { Router } from "express";
import {
  login,
  changePassword,
  changePasswordFromLogin,
} from "../controllers/AuthController";

import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

// Đăng nhập
router.post("/login", login);

// Đổi mật khẩu khi đã đăng nhập
router.post("/change-password", authMiddleware, changePassword);

// Đổi mật khẩu khi chưa đăng nhập
router.post("/change-password-from-login", changePasswordFromLogin);

export default router;
