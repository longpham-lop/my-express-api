import { Response } from "express";

import Ingredient from "../models/Ingredient";

import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = [
  "admin",
  "chain_manager",
];

const MANAGE_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const canManageIngredient = (role?: string) => {
  return !!role && MANAGE_ROLES.includes(role);
};

const canViewIngredient = (role?: string) => {
  return !!role && [
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen",
  ].includes(role);
};

/* =====================================================
   GET ALL
===================================================== */

export const getAllIngredients = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canViewIngredient(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem nguyên liệu",
      });
    }

    const ingredients = await Ingredient.findAll({
      order: [["id", "DESC"]],
    });

    return res.json(ingredients);
  } catch (error: unknown) {
    console.error(
      "GET ALL INGREDIENTS ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể lấy danh sách nguyên liệu";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
   GET BY ID
===================================================== */

export const getIngredientById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canViewIngredient(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem nguyên liệu",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID nguyên liệu không hợp lệ",
      });
    }

    const ingredient =
      await Ingredient.findByPk(id);

    if (!ingredient) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu",
      });
    }

    return res.json(ingredient);
  } catch (error: unknown) {
    console.error(
      "GET INGREDIENT ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy nguyên liệu",
    });
  }
};

/* =====================================================
   CREATE
===================================================== */

export const createIngredient = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canManageIngredient(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền thêm nguyên liệu",
      });
    }

    const {
      name,
      unit,
      category,
      minimum_stock,
    } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        message: "Tên nguyên liệu là bắt buộc",
      });
    }

    if (
      typeof unit !== "string" ||
      !unit.trim()
    ) {
      return res.status(400).json({
        message: "Đơn vị tính là bắt buộc",
      });
    }

    const minimumStock =
      Number(minimum_stock ?? 0);

    if (
      !Number.isFinite(minimumStock) ||
      minimumStock < 0
    ) {
      return res.status(400).json({
        message:
          "Mức tồn tối thiểu không hợp lệ",
      });
    }

    const existing =
      await Ingredient.findOne({
        where: {
          name: name.trim(),
        },
      });

    if (existing) {
      return res.status(409).json({
        message:
          "Nguyên liệu này đã tồn tại",
      });
    }

    const ingredient =
      await Ingredient.create({
        name: name.trim(),
        unit: unit.trim(),
        category:
          typeof category === "string" &&
          category.trim()
            ? category.trim()
            : null,
        minimum_stock: minimumStock,
        status: "active",
      });

    return res.status(201).json({
      message:
        "Thêm nguyên liệu thành công",
      data: ingredient,
    });
  } catch (error: unknown) {
    console.error(
      "CREATE INGREDIENT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể thêm nguyên liệu";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
   UPDATE
===================================================== */

export const updateIngredient = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canManageIngredient(req.user.role)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền sửa nguyên liệu",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID nguyên liệu không hợp lệ",
      });
    }

    const ingredient =
      await Ingredient.findByPk(id);

    if (!ingredient) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu",
      });
    }

    const {
      name,
      unit,
      category,
      minimum_stock,
      status,
    } = req.body;

    if (
      name !== undefined &&
      (
        typeof name !== "string" ||
        !name.trim()
      )
    ) {
      return res.status(400).json({
        message: "Tên nguyên liệu không hợp lệ",
      });
    }

    if (
      unit !== undefined &&
      (
        typeof unit !== "string" ||
        !unit.trim()
      )
    ) {
      return res.status(400).json({
        message: "Đơn vị tính không hợp lệ",
      });
    }

    if (
      status !== undefined &&
      !["active", "inactive"].includes(status)
    ) {
      return res.status(400).json({
        message: "Trạng thái không hợp lệ",
      });
    }

    let minimumStock =
      ingredient.minimum_stock;

    if (minimum_stock !== undefined) {
      minimumStock = Number(
        minimum_stock
      );

      if (
        !Number.isFinite(minimumStock) ||
        minimumStock < 0
      ) {
        return res.status(400).json({
          message:
            "Mức tồn tối thiểu không hợp lệ",
        });
      }
    }

    if (
      name !== undefined &&
      name.trim() !== ingredient.name
    ) {
      const duplicate =
        await Ingredient.findOne({
          where: {
            name: name.trim(),
          },
        });

      if (
        duplicate &&
        duplicate.id !== ingredient.id
      ) {
        return res.status(409).json({
          message:
            "Tên nguyên liệu đã tồn tại",
        });
      }
    }

    await ingredient.update({
      name:
        name !== undefined
          ? name.trim()
          : ingredient.name,

      unit:
        unit !== undefined
          ? unit.trim()
          : ingredient.unit,

      category:
        category !== undefined
          ? (
              typeof category === "string" &&
              category.trim()
                ? category.trim()
                : null
            )
          : ingredient.category,

      minimum_stock: minimumStock,

      status:
        status !== undefined
          ? status
          : ingredient.status,
    });

    return res.json({
      message:
        "Cập nhật nguyên liệu thành công",
      data: ingredient,
    });
  } catch (error: unknown) {
    console.error(
      "UPDATE INGREDIENT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể cập nhật nguyên liệu";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
   DELETE
===================================================== */

export const deleteIngredient = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!canManageIngredient(req.user.role)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa nguyên liệu",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID nguyên liệu không hợp lệ",
      });
    }

    const ingredient =
      await Ingredient.findByPk(id);

    if (!ingredient) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu",
      });
    }

    await ingredient.destroy();

    return res.json({
      message:
        "Xóa nguyên liệu thành công",
    });
  } catch (error: unknown) {
    console.error(
      "DELETE INGREDIENT ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể xóa nguyên liệu";

    return res.status(500).json({
      message,
    });
  }
};