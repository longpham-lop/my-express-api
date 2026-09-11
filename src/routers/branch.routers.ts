import { Router } from "express";
import { assignStaff, createArea, createBranch, listAreas, listBranches, listPublicBranches, updateBranch, updateBranchSettings } from "../controllers/BranchController";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireChainManager } from "../middlewares/permission.middleware";

const router = Router();

router.get("/public", listPublicBranches);
router.use(authMiddleware, requireChainManager);
router.get("/", listBranches);
router.post("/", createBranch);
router.put("/:id", updateBranch);
router.put("/:id/settings", updateBranchSettings);
router.get("/:id/areas", listAreas);
router.post("/:id/areas", createArea);
router.put("/:id/staff", assignStaff);

export default router;
