import { Router } from "express";
import { MenuController } from "../controllers/MenuController";
import { authMiddleware } from "../middlewares/auth.middleware";
import { isAdmin } from "../middlewares/role.middleware";

const router = Router();

    
router.get("/", MenuController.getAll);       // READ ALL
router.get("/:id", MenuController.getById);   // READ ONE
router.post("/",authMiddleware, isAdmin, MenuController.create);      // CREATE
router.put("/:id",authMiddleware, isAdmin, MenuController.update);    // UPDATE
router.delete("/:id",authMiddleware, isAdmin, MenuController.delete); // DELETE

export default router;
