import { Response } from "express";

import RecipeItem from "../models/RecipeItem";
import MenuItem from "../models/Menu";
import Ingredient from "../models/Ingredient";

import { AuthRequest } from "../middlewares/auth.middleware";

/* =========================================================
   ROLE
========================================================= */

const VIEW_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
  "kitchen",
];

const MANAGE_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

/* =========================================================
   GET ALL RECIPES
   GET /api/recipes
========================================================= */

export const getAllRecipes = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!VIEW_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem công thức",
      });
    }

    const recipes = await RecipeItem.findAll({
      include: [
        {
          model: MenuItem,
          as: "menu",
          attributes: ["id", "name", "price"],
        },
        {
          model: Ingredient,
          as: "ingredient",
          attributes: [
            "id",
            "name",
            "unit",
            "category",
            "status",
          ],
        },
      ],
      order: [["id", "ASC"]],
    });

    return res.json(recipes);
  } catch (error) {
    console.error("GET ALL RECIPES ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách công thức",
    });
  }
};

/* =========================================================
   GET RECIPE BY MENU
   GET /api/recipes/menu/:menuItemId
========================================================= */

export const getRecipeByMenu = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!VIEW_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem công thức",
      });
    }

    const menuItemId = Number(req.params.menuItemId);

    if (!Number.isInteger(menuItemId)) {
      return res.status(400).json({
        message: "menuItemId không hợp lệ",
      });
    }

    const menu = await MenuItem.findByPk(menuItemId);

    if (!menu) {
      return res.status(404).json({
        message: "Không tìm thấy món ăn",
      });
    }

    const recipe = await RecipeItem.findAll({
      where: {
        menu_item_id: menuItemId,
      },

      include: [
        {
          model: Ingredient,
          as: "ingredient",
          attributes: [
            "id",
            "name",
            "unit",
            "category",
            "status",
          ],
        },
      ],

      order: [["id", "ASC"]],
    });

    return res.json({
      menu: {
        id: menu.id,
        name: menu.name,
      },
      recipe,
    });
  } catch (error) {
    console.error("GET RECIPE BY MENU ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy công thức món",
    });
  }
};

/* =========================================================
   CREATE RECIPE ITEM
   POST /api/recipes
========================================================= */

export const createRecipeItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!MANAGE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền tạo công thức",
      });
    }

    const {
      menu_item_id,
      ingredient_id,
      quantity,
      unit,
    } = req.body as {
      menu_item_id?: number;
      ingredient_id?: number;
      quantity?: number;
      unit?: string;
    };

    const menuItemId = Number(menu_item_id);
    const ingredientId = Number(ingredient_id);
    const parsedQuantity = Number(quantity);

    /* =====================================================
       VALIDATE
    ===================================================== */

    if (!Number.isInteger(menuItemId)) {
      return res.status(400).json({
        message: "menu_item_id không hợp lệ",
      });
    }

    if (!Number.isInteger(ingredientId)) {
      return res.status(400).json({
        message: "ingredient_id không hợp lệ",
      });
    }

    if (
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0
    ) {
      return res.status(400).json({
        message: "quantity phải lớn hơn 0",
      });
    }

    if (!unit || !unit.trim()) {
      return res.status(400).json({
        message: "unit là bắt buộc",
      });
    }

    /* =====================================================
       CHECK MENU
    ===================================================== */

    const menu = await MenuItem.findByPk(menuItemId);

    if (!menu) {
      return res.status(404).json({
        message: "Không tìm thấy món ăn",
      });
    }

    /* =====================================================
       CHECK INGREDIENT
    ===================================================== */

    const ingredient = await Ingredient.findByPk(
      ingredientId
    );

    if (!ingredient) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu",
      });
    }

    if (ingredient.status !== "active") {
      return res.status(400).json({
        message: "Nguyên liệu đang ở trạng thái ngừng sử dụng",
      });
    }

    /* =====================================================
       CHECK DUPLICATE
    ===================================================== */

    const existed = await RecipeItem.findOne({
      where: {
        menu_item_id: menuItemId,
        ingredient_id: ingredientId,
      },
    });

    if (existed) {
      return res.status(409).json({
        message:
          "Nguyên liệu này đã tồn tại trong công thức món",
      });
    }

    /* =====================================================
       CREATE
    ===================================================== */

    const recipeItem = await RecipeItem.create({
      menu_item_id: menuItemId,
      ingredient_id: ingredientId,
      quantity: parsedQuantity,
      unit: unit.trim(),
    });

    return res.status(201).json({
      message: "Thêm nguyên liệu vào công thức thành công",
      data: recipeItem,
    });
  } catch (error) {
    console.error("CREATE RECIPE ITEM ERROR:", error);

    return res.status(500).json({
      message: "Không thể thêm nguyên liệu vào công thức",
    });
  }
};

/* =========================================================
   UPDATE RECIPE ITEM
   PUT /api/recipes/:id
========================================================= */

export const updateRecipeItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!MANAGE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền sửa công thức",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID công thức không hợp lệ",
      });
    }

    const recipeItem = await RecipeItem.findByPk(id);

    if (!recipeItem) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu trong công thức",
      });
    }

    const {
      quantity,
      unit,
    } = req.body as {
      quantity?: number;
      unit?: string;
    };

    const updateData: {
      quantity?: number;
      unit?: string;
    } = {};

    if (quantity !== undefined) {
      const parsedQuantity = Number(quantity);

      if (
        !Number.isFinite(parsedQuantity) ||
        parsedQuantity <= 0
      ) {
        return res.status(400).json({
          message: "quantity phải lớn hơn 0",
        });
      }

      updateData.quantity = parsedQuantity;
    }

    if (unit !== undefined) {
      if (!unit.trim()) {
        return res.status(400).json({
          message: "unit không được để trống",
        });
      }

      updateData.unit = unit.trim();
    }

    await recipeItem.update(updateData);

    return res.json({
      message: "Cập nhật công thức thành công",
      data: recipeItem,
    });
  } catch (error) {
    console.error("UPDATE RECIPE ITEM ERROR:", error);

    return res.status(500).json({
      message: "Không thể cập nhật công thức",
    });
  }
};

/* =========================================================
   DELETE RECIPE ITEM
   DELETE /api/recipes/:id
========================================================= */

export const deleteRecipeItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!MANAGE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa công thức",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID công thức không hợp lệ",
      });
    }

    const recipeItem = await RecipeItem.findByPk(id);

    if (!recipeItem) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu trong công thức",
      });
    }

    await recipeItem.destroy();

    return res.json({
      message: "Xóa nguyên liệu khỏi công thức thành công",
    });
  } catch (error) {
    console.error("DELETE RECIPE ITEM ERROR:", error);

    return res.status(500).json({
      message: "Không thể xóa nguyên liệu khỏi công thức",
    });
  }
};