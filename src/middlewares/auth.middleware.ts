import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import User from "../models/User";
import Role from "../models/Role";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role_id: number;
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
    ) as { id: number; role_id: number };

    const user = await User.findByPk(decoded.id);

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = {
      id: user.id,
      role_id: user.role_id, // ✅ number
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};
