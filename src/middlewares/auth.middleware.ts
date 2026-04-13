import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
// import User from "../models/User";
// import Role from "../models/Role";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role?: string;
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as { id: number; role: string };

    console.log("DECODED:", decoded);

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.log("JWT ERROR:", err);
    return res.status(401).json({ message: "Invalid token" });
  }
};