import { Router } from "express";
import { getDashboard } from "../controllers/DashboardController";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

router.get(
  "/",
  authMiddleware,
  requireRole("admin", "chain_manager", "branch_manager"),
  getDashboard
);

export default router;