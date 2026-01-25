import { Request, Response } from "express";
import { MenuItem } from "../models/MenuItem";

export class MenuController {

  static async create(req: Request, res: Response) {
    const item = await MenuItem.create(req.body);
    res.status(201).json(item);
  }

  static async getAll(req: Request, res: Response) {
    res.json(await MenuItem.findAll());
  }

  static async getById(req: Request, res: Response) {
    const item = await MenuItem.findById(Number(req.params.id));
    if (!item) return res.status(404).json({ message: "Not found" });
    res.json(item);
  }

  static async update(req: Request, res: Response) {
    const item = await MenuItem.update(
      Number(req.params.id),
      req.body
    );
    res.json(item);
  }

  static async delete(req: Request, res: Response) {
    await MenuItem.delete(Number(req.params.id));
    res.json({ message: "Deleted" });
  }
}
