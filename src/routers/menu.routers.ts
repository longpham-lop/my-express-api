import { Router } from "express";
import { createMenuItem,
        getAllMenuItems,
        getMenuItemById,
        updateMenuItem,
        deleteMenuItem  
 } from "../controllers/MenuController";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/role.middleware";

const router = Router();

    
router.get("/", getAllMenuItems);       // READ ALL
router.get("/:id", getMenuItemById);   // READ ONE
router.post("/",authMiddleware, isAdmin, createMenuItem);      // CREATE
router.put("/:id",authMiddleware, isAdmin, updateMenuItem);    // UPDATE
router.delete("/:id",authMiddleware, isAdmin, deleteMenuItem); // DELETE

export default router;
 