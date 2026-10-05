import { Router } from "express";
import authRouter from "./auth.routers";
import tableRouter from "./table.routers";
import menuRouter from "./menu.routers";
import orderRouter from "./order.routers";
import reservationRouter from "./reservation.routers";
import kitchenRouter from "./kitchen.routers";

const router = Router();

router.use("/auth", authRouter);
router.use("/tables", tableRouter);
router.use("/menu", menuRouter);
router.use("/orders", orderRouter);
router.use("/reservations", reservationRouter);
router.use("/kitchen", kitchenRouter);

export default router;