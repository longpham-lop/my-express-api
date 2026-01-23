import { Router } from "express";
import {
  getMenu,
  getMenuItemById,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../controllers/MenuController";

const router = Router();

// /api/menu
router.get("/", getMenu);
router.get("/:id", getMenuItemById);
router.post("/", createMenuItem);
router.put("/:id", updateMenuItem);
router.delete("/:id", deleteMenuItem);

export default router;
