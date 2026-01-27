import { Request, Response } from "express";
import User from "../models/User";

export class UserController {

  // Tạo mới user
  static async create(req: Request, res: Response) {
    try {
      const user = await User.create(req.body);
      res.status(201).json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Lấy tất cả user
  static async getAll(req: Request, res: Response) {
    try {
      const users = await User.findAll();
      res.json(users);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Lấy user theo ID
  static async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ message: "Not found" });
      res.json(user);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Xóa user
  static async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ message: "Not found" });

      await user.destroy(); // ✅ dùng destroy() thay cho delete()
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
