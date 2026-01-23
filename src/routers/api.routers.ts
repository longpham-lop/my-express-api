import { Router } from "express";
import authRouter from "./auth.routers";
import tableRouter from "./table.routers";
import menuRouter from "./menu.routers";
import orderRouter from "./order.routers";
import reservationRouter from "./reservation.routers";


const router = Router();

router.use("/auth", authRouter);
router.use("/tables", tableRouter);
router.use("/menu", menuRouter);
router.use("/orders", orderRouter);
router.use("/reservations", reservationRouter);

export default router;