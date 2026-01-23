import { Router } from "express";
import { getTables, createTable } from "../controllers/TableController";

const router = Router();

router.get("/", getTables);
router.post("/", createTable);

export default router;
