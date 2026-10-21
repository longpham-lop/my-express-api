
import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getSalesAnalytics } from "../controllers/SalesAnalyticsController";

const router = Router();

router.use(authMiddleware);

router.get("/", getSalesAnalytics);

export default router;
