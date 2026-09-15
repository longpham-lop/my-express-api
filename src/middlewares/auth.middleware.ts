import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    branchId: number | null;
  };
}

interface JwtPayload {
  id: number;
  role: string;
  branchId: number | null;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Lấy Authorization header
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    // 2. Kiểm tra Bearer token
    const parts = authorization.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer") {
      return res.status(401).json({
        message: "Token không hợp lệ",
      });
    }

    const token = parts[1];

    // 3. Verify JWT
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as JwtPayload;

    console.log("========== JWT ==========");
    console.log("User ID:", decoded.id);
    console.log("Role:", decoded.role);
    console.log("Branch ID:", decoded.branchId);
    console.log("=========================");

    // 4. Lưu thông tin user vào request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      branchId: decoded.branchId ?? null,
    };

    // 5. Cho request đi tiếp
    next();
  } catch (err) {
    console.log("JWT ERROR:", err);

    return res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};