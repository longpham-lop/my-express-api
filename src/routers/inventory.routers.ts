import { Router } from "express";

import {
  getAllInventory,
  getInventoryById,
  createInventory,
  updateInventory,
  deleteInventory,
} from "../controllers/BranchInventoryController";
import {
  adjustInventory,
} from "../controllers/InventoryAdjustmentController";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";


const router = Router();

router.get(
  "/stock",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen"
  ),
  getAllInventory
);

router.get(
  "/stock/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen"
  ),
  getInventoryById
);


router.post(
  "/stock",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  createInventory
);

router.put(
  "/stock/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  updateInventory
);

router.delete(
  "/stock/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  deleteInventory
);
router.post(
  "/adjustments",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  adjustInventory
);
export default router;