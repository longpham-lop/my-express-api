import { Router } from "express";
import { TableController } from "../controllers/TableController";

const router = Router();

router.get("/", TableController.getAll);
router.put("/:id/status", TableController.updateStatus);

export default router;
