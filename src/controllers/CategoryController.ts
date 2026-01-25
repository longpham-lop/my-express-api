import { Request, Response } from "express";
import { Category } from "../models/Category";

export class CategoryController {
  static async create(req: Request, res: Response) {
    res.status(201).json(await Category.create(req.body.name));
  }

  static async getAll(req: Request, res: Response) {
    res.json(await Category.findAll());
  }
}
