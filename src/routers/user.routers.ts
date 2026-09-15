import express from "express";
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/UserController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = express.Router();

router.post("/", authMiddleware, requireRole("admin", "chain_manager", "branch_manager"), createUser);
router.get("/", authMiddleware, requireRole("admin", "chain_manager", "branch_manager"), getUsers);
router.get("/:id", authMiddleware, requireRole("admin", "chain_manager", "branch_manager"), getUserById);
router.put("/:id", authMiddleware, requireRole("admin", "chain_manager", "branch_manager"), updateUser);
router.delete("/:id", authMiddleware, requireRole("admin", "chain_manager", "branch_manager"), deleteUser);

export default router;