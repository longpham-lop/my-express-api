import { Request, Response } from "express";
import MenuItem from "../models/Menu";
import Category from "../models/Category";
import { Op } from "sequelize";

/* ================= CREATE ================= */
export const createMenuItem = async (req: Request, res: Response) => {
  try {
    const { name, price, category_id, description, image } = req.body;

    if (!name || !price || !category_id) {
      return res.status(400).json({
        message: "name, price, category_id are required",
      });
    }

    const category = await Category.findByPk(category_id);
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }
    console.log(req.body);
    const item = await MenuItem.create({
      name,
      price,
      category_id,
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
};

/* ================= GET ALL ================= */
/* ================= GET ALL ================= */
export const getAllMenuItems = async (
  req: Request,
  res: Response
) => {
  try {
    const branchIdParam = req.query.branch_id;
    const activeOnly = req.query.active_only === "true";

    let branchId: number | undefined;

    // Kiểm tra branch_id nếu có truyền lên
    if (branchIdParam !== undefined) {
      branchId = Number(branchIdParam);

      if (!Number.isInteger(branchId) || branchId <= 0) {
        return res.status(400).json({
          message: "branch_id không hợp lệ",
        });
      }
    }

    // Xây dựng điều kiện truy vấn
    const whereCondition = {
      is_deleted: false,

      ...(activeOnly
        ? { isActive: true }
        : {}),

      ...(branchId !== undefined
        ? {
            [Op.or]: [
              { branch_id: branchId },
              { branch_id: null },
            ],
          }
        : {}),
    };

    const items = await MenuItem.findAll({
      where: whereCondition,
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
      order: [["id", "DESC"]],
    });

    return res.json({
      message: "Get all menu items success",
      data: items,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Không thể lấy danh sách món ăn";

    console.error("GET ALL MENU ITEMS ERROR:", err);

    return res.status(500).json({
      message,
    });
  }
};

/* ================= GET BY ID ================= */
export const getMenuItemById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const item = await MenuItem.findByPk(id, {
      include: [
        {
          model: Category,
        },
      ],
    });

    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    return res.json(item);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* ================= UPDATE ================= */
export const updateMenuItem = async (req: Request, res: Response) => {
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
};

/* ================= DELETE ================= */
export const deleteMenuItem = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const item = await MenuItem.findByPk(id);
    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    await item.update({ is_deleted: true });

    return res.json({
      message: "Menu item deleted successfully",
    });
  } catch (err: any) {
    if (err.name === "SequelizeForeignKeyConstraintError") {
      return res.status(400).json({
        message: "Không thể xóa vì món ăn đã tồn tại trong đơn hàng!",
      });
    }

    return res.status(500).json({ message: err.message });
  }
  
};