import { Router } from "express";

import {
  getAllInventoryTransactions,
  getInventoryTransactionById,
} from "../controllers/InventoryTransactionController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";


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