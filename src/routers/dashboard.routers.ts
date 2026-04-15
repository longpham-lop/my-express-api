import { Router } from "express";
import { getDashboard } from "../controllers/DashboardController";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/role.middleware";

const router = Router();

router.get("/", authMiddleware, isAdmin, getDashboard);

export default router;