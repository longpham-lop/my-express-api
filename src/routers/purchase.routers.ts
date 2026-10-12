import { Router } from "express";

import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  confirmPurchase,
  cancelPurchase,
} from "../controllers/PurchaseController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

const viewRoles = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
  "kitchen",
  "cashier",
];

const manageRoles = [
  "admin",
  "chain_manager",
  "branch_manager",
];

router.get(
  "/",
  authMiddleware,
  requireRole(...viewRoles),
  getAllPurchases
);

router.get(
  "/:id",
  authMiddleware,
  requireRole(...viewRoles),
  getPurchaseById
);

router.post(
  "/",
  authMiddleware,
  requireRole(...manageRoles),
  createPurchase
);

router.put(
  "/:id",
  authMiddleware,
  requireRole(...manageRoles),
  updatePurchase
);


router.patch(
  "/:id/confirm",
  authMiddleware,
  requireRole(...manageRoles),
  confirmPurchase
);

router.patch(
  "/:id/cancel",
  authMiddleware,
  requireRole(...manageRoles),
  cancelPurchase
);

export default router;