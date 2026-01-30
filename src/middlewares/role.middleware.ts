import { Response, NextFunction } from "express";

export const isAdmin = (req: any, res: Response, next: NextFunction) => {
  if (!req.user || req.user.Role.name !== "admin") {
    return res.status(403).json({ message: "Admin only" });
  }
  next();
};
