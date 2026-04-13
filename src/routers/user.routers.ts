import express from "express";
import {
  createUser,
  getUsers,
  getUserById,
  deleteUser,
} from "../controllers/UserController";

const router = express.Router();

router.post("/", createUser);
router.get("/", getUsers);
router.get("/:id", getUserById);
router.delete("/:id", deleteUser);

export default router;