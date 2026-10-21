import { Router } from "express";

import {
  getAllInventoryTransactions,
  getInventoryTransactionById,
  adjustInventory,
} from "../controllers/InventoryTransactionController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { getLowStockInventory } from "../controllers/InventoryAlertController";


const router = Router();


router.get(
  "/",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen",
    "cashier"
  ),
  getAllInventoryTransactions
);

router.post("/adjust", authMiddleware, adjustInventory);
router.get("/low-stock", authMiddleware, getLowStockInventory);

router.get(
  "/:id",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager",
    "waiter",
    "kitchen",
    "cashier"
  ),
  getInventoryTransactionById
);


export default router;