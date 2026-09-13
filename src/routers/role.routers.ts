import express from "express";

import {
    getRoles
 } from "../controllers/RoleController";

const router = express.Router();

router.get("/", getRoles);

export default router;