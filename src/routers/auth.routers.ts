import { Router } from "express";
import {
  login,
  register,
  changePassword,
  changePasswordFromLogin,
} from "../controllers/AuthController";

import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);

// Đổi mật khẩu yêu cầu đăng nhập
router.post(
  "/change-password",
  authMiddleware,
  changePassword
);
router.post("/change-password-from-login", changePasswordFromLogin);
export default router;