import { Router } from "express";

import {
  getMyOrderItems,
  createOrderItem,
  deleteOrderItem,
  updateOrderItem,
  updateOrderItemStatus,
} from "../controllers/OrderItemController";

import {
  authMiddleware,
} from "../middlewares/auth.middleware";

const router = Router();

/*
 * Tất cả endpoint OrderItem đều yêu cầu đăng nhập.
 */

router.use(authMiddleware);

/*
 * GET /api/order-items
 * Lấy danh sách món của khách hàng.
 */
router.get(
  "/",
  getMyOrderItems
);

/*
 * POST /api/order-items
 * Thêm món vào Order.
 */
router.post(
  "/",
  createOrderItem
);

/*
 * PUT /api/order-items/:id
 * Cập nhật số lượng món.
 */
router.put(
  "/:id",
  updateOrderItem
);

/*
 * DELETE /api/order-items/:id
 * Hủy món, không xóa vật lý.
 */
router.delete(
  "/:id",
  deleteOrderItem
);

/*
 * PUT /api/order-items/:id/status
 * Cập nhật trạng thái món.
 */
router.put(
  "/:id/status",
  updateOrderItemStatus
);

export default router;