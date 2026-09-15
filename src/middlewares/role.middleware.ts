import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
   console.log("CHECK ROLE:", req.user);
  if (!req.user || !["admin", "chain_manager"].includes(req.user.role || "")) {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};

export const requireRole = (...allowedRoles: string[]) => {
  return (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    // Chưa đăng nhập
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    // Role hiện tại
    const userRole = req.user.role;

    console.log("========== RBAC ==========");
    console.log("User ID:", req.user.id);
    console.log("Role:", userRole);
    console.log("Allowed:", allowedRoles);
    console.log("==========================");

    // Kiểm tra role
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền thực hiện chức năng này",
      });
    }

    next();
  };
};
