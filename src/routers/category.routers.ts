import { Router } from "express";
import { CategoryController } from "../controllers/CategoryController";

const router = Router();

router.post("/", CategoryController.create);
router.get("/", CategoryController.getAll);

export default router;
