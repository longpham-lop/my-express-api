import { Request, Response } from "express";
import MenuItem from "../models/Menu";
import Category from "../models/Category";

export class MenuController {
  // CREATE
  static async create(req: Request, res: Response) {
    try {
      const { name, price, categoryId, description, image } = req.body;

      if (!name || !price || !categoryId) {
        return res.status(400).json({
          message: "name, price, categoryId are required",
        });
      }

      // check category tồn tại
      const category = await Category.findByPk(categoryId);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      const item = await MenuItem.create({
        name,
        price,
        categoryId,
        description,
        image,
      });

      return res.status(201).json({
        message: "Menu item created successfully",
        data: item,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  // GET ALL
  static async getAll(req: Request, res: Response) {
    try {
      const items = await MenuItem.findAll({
        include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name"],
      },
    ],
        order: [["id", "DESC"]],
      });

      return res.json(items);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  // GET BY ID
  static async getById(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const item = await MenuItem.findByPk(id, {
        include: Category,
      });

      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      return res.json(item);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  // UPDATE
  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const item = await MenuItem.findByPk(id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      await item.update(req.body);

      return res.json({
        message: "Menu item updated successfully",
        data: item,
      });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }

  // DELETE
  static async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      const item = await MenuItem.findByPk(id);
      if (!item) {
        return res.status(404).json({ message: "Menu item not found" });
      }

      await item.destroy();

      return res.json({ message: "Menu item deleted successfully" });
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }
}
