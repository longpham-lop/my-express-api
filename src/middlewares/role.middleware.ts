import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log("CHECK ROLE:", req.user);

  if (
    !req.user ||
    !["admin", "chain_manager"].includes(req.user.role || "")
  ) {
    return res.status(403).json({
      message: "Admin only",
    });
  }

  next();
};

export const requireRole = (...allowedRoles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const userRole = req.user.role;

    console.log("========== RBAC ==========");
    console.log("User ID:", req.user.id);
    console.log("Role:", userRole);
    console.log("Allowed:", allowedRoles);
    console.log("==========================");

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền thực hiện chức năng này",
      });
    }

    next();
  };
};

/**
 * Quyền quản lý cấu trúc bàn:
 * - admin
 * - chain_manager
 * - branch_manager
 *
 * waiter chỉ được xem/vận hành bàn,
 * không được tạo/sửa/xóa cấu trúc bàn.
 */
export const requireTableManager = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Chưa đăng nhập",
    });
  }

  const allowedRoles = [
    "admin",
    "chain_manager",
    "branch_manager",
  ];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      message: "Bạn không có quyền quản lý bàn",
    });
  }

  next();
};