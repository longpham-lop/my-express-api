import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth.middleware";

const chainRoles = new Set(["admin", "chain_manager"]);
const branchManagementRoles = new Set(["admin", "chain_manager", "branch_manager"]);

export const requireChainManager = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.role || !chainRoles.has(req.user.role)) {
    return res.status(403).json({ message: "Chỉ quản lý chuỗi được thực hiện thao tác này" });
  }
  next();
};

export const requireBranchManager = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.role || !branchManagementRoles.has(req.user.role)) {
    return res.status(403).json({ message: "Bạn không có quyền quản lý chi nhánh" });
  }
  next();
};
