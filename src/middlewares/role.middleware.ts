import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
   console.log("CHECK ROLE:", req.user);
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};
