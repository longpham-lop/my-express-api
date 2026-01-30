// src/controllers/CategoryController.ts
import { Request, Response } from "express";
import Category from "../models/Category";

export class CategoryController {
  // CREATE
  static async create(req: Request, res: Response) {
    try {
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ message: "Category name is required" });
      }

      const exist = await Category.findOne({ where: { name } });
      if (exist) {
        return res.status(409).json({ message: "Category already exists" });
      }

      const category = await Category.create({ name });

      return res.status(201).json({
        message: "Category created successfully",
        data: category,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  // GET ALL
  static async getAll(req: Request, res: Response) {
    try {
      const categories = await Category.findAll({
        order: [["id", "DESC"]],
      });

      return res.json(categories);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  // GET BY ID
  static async getById(req: Request, res: Response) {
    try {
      const id = Number (req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid category id" });
    }
      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      return res.json(category);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  // UPDATE
  static async update(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { name } = req.body;
      if(isNaN(id)){
        return res.status(400).json({ message: "Invalid category id" });
      }
      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      category.name = name ?? category.name;
      await category.save();

      return res.json({
        message: "Category updated successfully",
        data: category,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }

  // DELETE
  static async delete(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      if(isNaN(id)){
        return res.status(400).json({ message: "Invalid category id" });
      }
      const category = await Category.findByPk(id);
      if (!category) {
        return res.status(404).json({ message: "Category not found" });
      }

      await category.destroy();
      return res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  }
}
