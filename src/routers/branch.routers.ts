import { Router } from "express";

import {
  assignStaff,
  createArea,
  createBranch,
  listAreas,
  listBranches,
  listPublicBranches,
  updateBranch,
  updateBranchSettings,
} from "../controllers/BranchController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireChainManager } from "../middlewares/permission.middleware";
import { requireRole } from "../middlewares/role.middleware";

const router = Router();

/**
 * PUBLIC
 * Không cần đăng nhập
 */
router.get("/public", listPublicBranches);

/**
 * GET BRANCHES
 *
 * Admin:
 *      xem tất cả chi nhánh
 *
 * Chain manager:
 *      xem tất cả chi nhánh
 *
 * Branch manager:
 *      chỉ xem chi nhánh của mình
 */
router.get(
  "/",
  authMiddleware,
  requireRole("admin", "chain_manager", "branch_manager"),
  listBranches
);

/**
 * Các chức năng quản lý chi nhánh
 *
 * Chỉ Admin / Chain Manager
 */
router.use(authMiddleware, requireChainManager);

router.post("/", createBranch);

router.put("/:id", updateBranch);

router.put("/:id/settings", updateBranchSettings);

router.get("/:id/areas", listAreas);

router.post("/:id/areas", createArea);

router.put("/:id/staff", assignStaff);

export default router;