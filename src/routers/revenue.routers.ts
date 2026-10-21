
import { Router } from "express";
import { getRevenueReport } from "../controllers/RevenueReportController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/revenue", getRevenueReport);

export default router;
