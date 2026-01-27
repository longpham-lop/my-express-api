import { Request, Response } from "express";
import Table from "../models/Table";

export class TableController {
  // Lấy tất cả bảng
  static async getAll(req: Request, res: Response) {
    try {
      const tables = await Table.findAll(); // dùng Sequelize chuẩn
      res.json(tables);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Cập nhật status bảng
  static async updateStatus(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      // Cách 1: dùng update chuẩn Sequelize
      const [updatedCount, updatedRows] = await Table.update(
        { status },
        { where: { id }, returning: true } // returning: true để lấy bản ghi sau update
      );

      if (updatedCount === 0) {
        return res.status(404).json({ message: "Table not found" });
      }

      res.json(updatedRows[0]); // trả về bảng đã update
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}