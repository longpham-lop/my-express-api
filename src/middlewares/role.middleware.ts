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
