import { Router } from "express";
import { getAllTable,
        createTable,
        updateStatus
 } from "../controllers/TableController";
 import { authMiddleware } from "../middlewares/auth.middleware";
 import { isAdmin } from "../middlewares/role.middleware";

const router = Router();

router.post("/", createTable);
router.get("/", getAllTable);
router.put("/:id/status", authMiddleware, isAdmin, updateStatus);

export default router;
