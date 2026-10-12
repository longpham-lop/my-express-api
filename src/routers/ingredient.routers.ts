import { Router } from "express";

import {
  getAllIngredients,
  getIngredientById,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} from "../controllers/IngredientController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

/*
 * Xem
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
  getAllIngredients
);

/*
 * Xem chi tiết
 */
router.get(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen"
  ),
  getIngredientById
);

/*
 * Thêm
 */
router.post(
  "/",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  createIngredient
);

/*
 * Sửa
 */
router.put(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  updateIngredient
);

/*
 * Xóa
 */
router.delete(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  deleteIngredient
);

export default router;