import { Request, Response } from "express";
import { User } from "../models/User";

export class UserController {

  static async create(req: Request, res: Response) {
    const user = await User.create(req.body);
    res.status(201).json(user);
  }

  static async getAll(req: Request, res: Response) {
    res.json(await User.findAll());
  }

  static async getById(req: Request, res: Response) {
    const user = await User.findById(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  }

  static async delete(req: Request, res: Response) {
    await User.delete(Number(req.params.id));
    res.json({ message: "Deleted" });
  }
}
