import { Request, Response } from "express";
import Category from "../models/Category";

/* ================= CREATE ================= */
export const createCategory = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Category name is required",
      });
    }

    const exist = await Category.findOne({ where: { name } });
    if (exist) {
      return res.status(409).json({
        message: "Category already exists",
      });
    }

    const category = await Category.create({ name });

    return res.status(201).json({
      message: "Category created successfully",
      data: category,
    });

  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* ================= GET ALL ================= */
export const getAllCategories = async (_: Request, res: Response) => {
  try {
    const data = await Category.findAll({
      order: [["id", "DESC"]],
    });

    res.json(data);

  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= GET BY ID ================= */
export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        message: "Invalid category id",
      });
    }

    const data = await Category.findByPk(id);

    if (!data) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    res.json(data);

  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= UPDATE ================= */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        message: "Invalid category id",
      });
    }

    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    await category.update({
      name: name ?? category.name,
    });

    res.json({
      message: "Update success",
      data: category,
    });

  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

/* ================= DELETE ================= */
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        message: "Invalid category id",
      });
    }

    const category = await Category.findByPk(id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    await category.destroy();

    res.json({
      message: "Delete success",
    });

  } catch (err: any) {

    // 🔥 giống menu (quan trọng)
    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Không thể xóa vì category đang được sử dụng!",
      });
    }

    res.status(500).json({ message: err.message });
  }
};