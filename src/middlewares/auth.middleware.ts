
import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload as JsonWebTokenPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    branchId: number | null;
  };
}

interface AppJwtPayload extends JsonWebTokenPayload {
  id: number;
  role: string;
  branchId?: number | null;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // 1. Kiểm tra cấu hình JWT_SECRET
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET chưa được cấu hình");

      return res.status(500).json({
        message: "Lỗi cấu hình xác thực máy chủ",
      });
    }

    // 2. Lấy Authorization header
    const authorization = req.headers.authorization;

    if (!authorization) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    // 3. Kiểm tra định dạng Bearer token
    const parts = authorization.split(" ");

    if (
      parts.length !== 2 ||
      parts[0] !== "Bearer" ||
      !parts[1]
    ) {
      return res.status(401).json({
        message: "Token không hợp lệ",
      });
    }

    const token = parts[1];

    // 4. Xác thực chữ ký và thời hạn token
    const decoded = jwt.verify(token, secret);

    // Payload JWT có thể là chuỗi, cần kiểm tra trước khi đọc thuộc tính
    if (
      typeof decoded !== "object" ||
      decoded === null
    ) {
      return res.status(401).json({
        message: "Dữ liệu token không hợp lệ",
      });
    }

    const payload = decoded as AppJwtPayload;

    // 5. Kiểm tra các trường bắt buộc
    if (
      !Number.isInteger(payload.id) ||
      payload.id <= 0 ||
      typeof payload.role !== "string" ||
      payload.role.trim() === ""
    ) {
      return res.status(401).json({
        message: "Thông tin người dùng trong token không hợp lệ",
      });
    }

    const branchId = payload.branchId ?? null;

    if (
      branchId !== null &&
      (!Number.isInteger(branchId) || branchId <= 0)
    ) {
      return res.status(401).json({
        message: "Chi nhánh trong token không hợp lệ",
      });
    }

    // 6. Gắn thông tin xác thực vào request
    req.user = {
      id: payload.id,
      role: payload.role,
      branchId,
    };

    // 7. Cho phép request đi tiếp
    next();
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error("JWT ERROR:", err.message);
    }

    return res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
};
