import { Router } from "express";

import {
  assignStaff,
  createArea,
  createBranch,
  listAreas,
  listPublicBranches,
  listBranches,
  updateArea,
  deleteArea,
  updateBranch,
  updateBranchSettings,
} from "../controllers/BranchController";

import { authMiddleware } from "../middlewares/auth.middleware";
import { requireRole } from "../middlewares/role.middleware";
import { requireChainManager } from "../middlewares/permission.middleware";

const router = Router();

/*
=====================================================
PUBLIC
=====================================================
*/

router.get(
  "/public",
  listPublicBranches
);

/*
=====================================================
XEM DANH SÁCH CHI NHÁNH
=====================================================
*/

router.get(
  "/",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  listBranches
);

/*
=====================================================
QUẢN LÝ KHU VỰC
admin
chain_manager
branch_manager
=====================================================
*/

router.get(
  "/:id/areas",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  listAreas
);

router.post(
  "/:id/areas",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  createArea
);

router.put(
  "/:id/areas/:areaId",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  updateArea
);

router.delete(
  "/:id/areas/:areaId",
  authMiddleware,
  requireRole(
    "admin",
    "chain_manager",
    "branch_manager"
  ),
  deleteArea
);

/*
=====================================================
QUẢN LÝ CHI NHÁNH
CHỈ ADMIN + CHAIN MANAGER
=====================================================
*/

router.use(
  authMiddleware,
  requireChainManager
);

router.post(
  "/",
  createBranch
);

router.put(
  "/:id",
  updateBranch
);

router.put(
  "/:id/settings",
  updateBranchSettings
);

router.put(
  "/:id/staff",
  assignStaff
);

export default router;