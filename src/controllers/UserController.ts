import { Request, Response } from "express";
import { getAllUsers, getUserByEmail } from "../models/User";

/**
 * GET /api/users
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await getAllUsers();
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};

/**
 * GET /api/users/email/:email
 */
export const getUserByEmailController = async (req: Request, res: Response) => {
  const { email } = req.params;
    if (typeof email !== "string") {
        return res.status(400).json({ message: "Email không hợp lệ" });
    }
  try {
    const user = await getUserByEmail(email);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy user" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
