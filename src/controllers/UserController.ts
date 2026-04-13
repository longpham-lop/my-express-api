import { Request, Response } from "express";
import User from "../models/User";
import bcrypt from "bcrypt";

/* ===== CREATE ===== */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, password là bắt buộc",
      });
    }

    // check email tồn tại
    const exist = await User.findOne({ where: { email } });
    if (exist) {
      return res.status(409).json({
        message: "Email đã tồn tại",
      });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role_id: 2, // mặc định user
    });

    return res.status(201).json({
      id: user.get("id"),
      name: user.get("name"),
      email: user.get("email"),
      role_id: user.get("role_id"),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

/* ===== GET ALL ===== */
export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "name", "email", "role_id"], // ❌ không trả password
      order: [["id", "DESC"]],
    });

    return res.json(users);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

/* ===== GET BY ID ===== */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const user = await User.findByPk(id, {
      attributes: ["id", "name", "email", "role_id"],
    });

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

/* ===== DELETE ===== */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: "User không tồn tại" });
    }

    await user.destroy();

    return res.json({ message: "Xóa user thành công" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};