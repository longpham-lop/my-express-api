import { Router } from "express";
import { MenuController } from "../controllers/MenuController";

const router = Router();

router.post("/", MenuController.create);      // CREATE
router.get("/", MenuController.getAll);       // READ ALL
router.get("/:id", MenuController.getById);   // READ ONE
router.put("/:id", MenuController.update);    // UPDATE
router.delete("/:id", MenuController.delete); // DELETE

export default router;
