import { Request, Response } from "express";
import { TableModel } from "../models/Table";

export class TableController {
  static async getAll(req: Request, res: Response) {
    res.json(await TableModel.findAll());
  }

  static async updateStatus(req: Request, res: Response) {
    const table = await TableModel.updateStatus(
      Number(req.params.id),
      req.body.status
    );
    res.json(table);
  }
}
