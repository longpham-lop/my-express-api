import { Router } from "express";
import { CategoryController } from "../controllers/CategoryController";

const router = Router();

router.post("/", CategoryController.create);
router.get("/", CategoryController.getAll);
router.get("/:id", CategoryController.getById);
router.put("/:id", CategoryController.update);
router.delete("/:id", CategoryController.delete);

export default router;
