import { Router } from "express";
import {
  getUsers,
  getUserByEmailController
} from "../controllers/UserController";

const router = Router();

// GET /api/users
router.get("/", getUsers);

// GET /api/users/email/:email
router.get("/email/:email", getUserByEmailController);

export default router;
