import { Router } from "express";

import {
  getAllRecipes,
  getRecipeByMenu,
  createRecipeItem,
  updateRecipeItem,
  deleteRecipeItem,
} from "../controllers/RecipeController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

/*
 * Xem toàn bộ recipe
 */
router.get(
  "/",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen"
  ),
  getAllRecipes
);

/*
 * Xem công thức của một món
 */
router.get(
  "/menu/:menuItemId",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen"
  ),
  getRecipeByMenu
);

/*
 * Thêm nguyên liệu vào công thức
 */
router.post(
  "/",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  createRecipeItem
);

/*
 * Sửa định lượng
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  updateRecipeItem
);

/*
 * Xóa nguyên liệu khỏi công thức
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  deleteRecipeItem
);

export default router;