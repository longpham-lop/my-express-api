import { Request, Response } from "express";
import MenuItem from "../models/MenuItem"; // chú ý import default export nếu bạn export default

export class MenuController {

  // Tạo mới
  static async create(req: Request, res: Response) {
    try {
      const item = await MenuItem.create(req.body);
      res.status(201).json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Lấy tất cả
  static async getAll(req: Request, res: Response) {
    try {
      const items = await MenuItem.findAll();
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Lấy theo ID
  static async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const item = await MenuItem.findByPk(id);
      if (!item) return res.status(404).json({ message: "Not found" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Cập nhật
  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const item = await MenuItem.findByPk(id);
      if (!item) return res.status(404).json({ message: "Not found" });

      // Cập nhật các trường trong body
      await item.update(req.body);

      res.json(item);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Xóa
  static async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const item = await MenuItem.findByPk(id);
      if (!item) return res.status(404).json({ message: "Not found" });

      await item.destroy(); // xóa bản ghi
      res.json({ message: "Deleted" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
