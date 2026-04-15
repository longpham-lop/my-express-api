import { Router } from "express";
import { getAllTable,
        createTable,
        updateStatus,
        getTableById,
        updateTable,
        deleteTable
 } from "../controllers/TableController";
 import { authMiddleware } from "../middlewares/auth.middleware";
 import { isAdmin } from "../middlewares/role.middleware";

const router = Router();

router.post("/",authMiddleware,isAdmin, createTable);
router.get("/", authMiddleware, getAllTable);
router.put("/:id/status", authMiddleware, isAdmin, updateStatus);
router.get("/:id", authMiddleware, getTableById);
router.put("/:id", authMiddleware, isAdmin, updateTable);
router.delete("/:id", authMiddleware, isAdmin, deleteTable);

export default router;
