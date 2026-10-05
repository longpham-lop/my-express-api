import { Router } from "express";
import { getKitchenOrders } from "../controllers/KitchenController";
import { authMiddleware } from "../middlewares/auth.middleware";

const router = Router();

router.use(authMiddleware);

router.get("/orders", getKitchenOrders);

export default router;