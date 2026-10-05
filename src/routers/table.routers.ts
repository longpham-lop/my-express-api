import { Router } from "express";

import {
  getAllTable,
  createTable,
  updateStatus,
  getTableById,
  updateTable,
  deleteTable,
} from "../controllers/TableController";

import { authMiddleware } from "../middlewares/auth.middleware";

import {
  requireTableManager,
} from "../middlewares/role.middleware";

const router = Router();

/**
 * CRUD cấu trúc bàn
 * Admin / Chain Manager / Branch Manager
 */
router.post(
  "/",
  authMiddleware,
  requireTableManager,
  createTable
);

router.put(
  "/:id",
  authMiddleware,
  requireTableManager,
  updateTable
);

router.delete(
  "/:id",
  authMiddleware,
  requireTableManager,
  deleteTable
);

/**
 * Xem bàn
 * Admin / Chain Manager / Branch Manager / Waiter
 */
router.get(
  "/",
  authMiddleware,
  getAllTable
);

router.get(
  "/:id",
  authMiddleware,
  getTableById
);

/**
 * Cập nhật trạng thái bàn
 * Hiện tại chỉ manager.
 */
router.put(
  "/:id/status",
  authMiddleware,
  requireTableManager,
  updateStatus
);

export default router;