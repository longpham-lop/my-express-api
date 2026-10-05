import { Response } from "express";

import OrderItem from "../models/OrderItem";
import Order from "../models/Order";
import MenuItem from "../models/Menu";

import { AuthRequest } from "../middlewares/auth.middleware";
import { getIO } from "../socket";

/* =====================================================
 * HELPER: UPDATE ORDER TOTAL
 * ===================================================== */

const updateOrderTotal = async (order_id: number) => {
  const items = await OrderItem.findAll({
    where: {
      order_id,
    },
  });

  const total_price = items.reduce(
    (sum, item) =>
      sum +
      Number(item.unit_price) *
        Number(item.quantity),
    0
  );

  await Order.update(
    {
      total_price,
    },
    {
      where: {
        id: order_id,
      },
    }
  );
};

/* =====================================================
 * HELPER: SYNC ORDER STATUS
 *
 * Quy tắc:
 *
 * Tất cả món cancelled
 * → Order cancelled
 *
 * Có ít nhất 1 món served
 * và tất cả món còn lại served/cancelled
 * → Order completed
 *
 * Có món cooking / ready / served
 * → Order processing
 *
 * Tất cả món pending
 * → Order pending
 * ===================================================== */

const syncOrderStatus = async (order_id: number) => {
  const items = await OrderItem.findAll({
    where: {
      order_id,
    },
  });

  /*
   * Order chưa có món
   */
  if (items.length === 0) {
    return;
  }

  const statuses = items.map(
    (item) => item.status
  );

  let newOrderStatus:
    | "pending"
    | "processing"
    | "completed"
    | "cancelled"
    | null = null;

  /*
   * =====================================================
   * 1. TẤT CẢ MÓN ĐỀU BỊ HỦY
   * =====================================================
   */

  const allCancelled = statuses.every(
    (status) => status === "cancelled"
  );

  if (allCancelled) {
    newOrderStatus = "cancelled";
  }

  /*
   * =====================================================
   * 2. TẤT CẢ MÓN ĐÃ HOÀN TẤT
   *
   * served hoặc cancelled
   *
   * Nhưng phải có ít nhất 1 món served.
   *
   * Ví dụ:
   *
   * served + served
   * → completed
   *
   * served + cancelled
   * → completed
   *
   * cancelled + cancelled
   * → cancelled
   * =====================================================
   */

  else {
    const allFinished = statuses.every(
      (status) =>
        status === "served" ||
        status === "cancelled"
    );

    const hasServed = statuses.some(
      (status) => status === "served"
    );

    if (allFinished && hasServed) {
      newOrderStatus = "completed";
    }

    /*
     * ===================================================
     * 3. ĐANG XỬ LÝ
     *
     * Có ít nhất một món:
     * cooking
     * ready
     * served
     * ===================================================
     */

    else if (
      statuses.some(
        (status) =>
          status === "cooking" ||
          status === "ready" ||
          status === "served"
      )
    ) {
      newOrderStatus = "processing";
    }

    /*
     * ===================================================
     * 4. TẤT CẢ ĐANG CHỜ
     * ===================================================
     */

    else if (
      statuses.every(
        (status) => status === "pending"
      )
    ) {
      newOrderStatus = "pending";
    }
  }

  /*
   * =====================================================
   * UPDATE ORDER
   * =====================================================
   */

  if (newOrderStatus) {
    await Order.update(
      {
        status: newOrderStatus,
      },
      {
        where: {
          id: order_id,
        },
      }
    );
  }
};

/* =====================================================
 * ROLE CONFIG
 * ===================================================== */

/*
 * Role được phép thao tác trạng thái món.
 *
 * Lưu ý:
 * cashier KHÔNG được thao tác trạng thái món.
 */
const STATUS_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "kitchen",
  "waiter",
];

/*
 * Trạng thái hợp lệ của OrderItem.
 */
const STATUS_LIST = [
  "pending",
  "cooking",
  "ready",
  "served",
  "cancelled",
] as const;

/* =====================================================
 * GET MY ORDER ITEMS
 * ===================================================== */

export const getMyOrderItems = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const data = await OrderItem.findAll({
      include: [
        {
          model: Order,
          where: {
            user_id: req.user.id,
          },
        },
        {
          model: MenuItem,
          as: "menu",
        },
      ],
    });

    return res.json(data);
  } catch (error: unknown) {
    console.error(
      "GET MY ORDER ITEMS ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể lấy danh sách món";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
 * CREATE ORDER ITEM
 * ===================================================== */

export const createOrderItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const {
      order_id,
      menu_item_id,
      quantity,
    } = req.body;

    /*
     * Kiểm tra dữ liệu bắt buộc
     */
    if (
      !order_id ||
      !menu_item_id ||
      quantity === undefined ||
      quantity === null
    ) {
      return res.status(400).json({
        message: "Thiếu dữ liệu",
      });
    }

    /*
     * Kiểm tra quantity
     */
    if (
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) <= 0
    ) {
      return res.status(400).json({
        message: "Quantity phải là số nguyên > 0",
      });
    }

    /*
     * Tìm Order
     */
    const order = await Order.findByPk(
      Number(order_id)
    );

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /*
     * User chỉ được thêm món vào order của mình.
     */
    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        message:
          "Bạn không có quyền thêm món vào order này",
      });
    }

    /*
     * Không cho thêm món vào order đã hoàn thành
     * hoặc đã hủy.
     */
    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      return res.status(400).json({
        message:
          "Không thể thêm món vào order đã hoàn tất hoặc đã hủy",
      });
    }

    /*
     * Tìm MenuItem
     */
    const menuItem = await MenuItem.findByPk(
      Number(menu_item_id)
    );

    if (!menuItem) {
      return res.status(404).json({
        message: "MenuItem không tồn tại",
      });
    }

    /*
     * Tạo OrderItem
     */
    const item = await OrderItem.create({
      order_id: Number(order_id),
      menu_item_id: Number(menu_item_id),
      quantity: Number(quantity),
      unit_price: Number(menuItem.price),
      status: "pending",
    });

    /*
     * Cập nhật tổng tiền Order
     */
    await updateOrderTotal(
      Number(order_id)
    );

    /*
     * Đồng bộ trạng thái Order
     */
    await syncOrderStatus(
      Number(order_id)
    );

    return res.status(201).json(item);
  } catch (error: unknown) {
    console.error(
      "CREATE ORDER ITEM ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể tạo món trong order";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
 * UPDATE ORDER ITEM QUANTITY
 * ===================================================== */

export const updateOrderItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const id = Number(req.params.id);
    const { quantity } = req.body;

    /*
     * Kiểm tra ID
     */
    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    /*
     * Kiểm tra quantity
     */
    if (
      !Number.isInteger(Number(quantity)) ||
      Number(quantity) <= 0
    ) {
      return res.status(400).json({
        message:
          "Quantity phải là số nguyên > 0",
      });
    }

    /*
     * Tìm OrderItem
     */
    const item = await OrderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message:
          "OrderItem không tồn tại",
      });
    }

    /*
     * Tìm Order
     */
    const order = await Order.findByPk(
      item.order_id
    );

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /*
     * User chỉ được sửa order của mình.
     */
    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        message:
          "Bạn không có quyền sửa món trong order này",
      });
    }

    /*
     * Không cho sửa món đã phục vụ hoặc hủy.
     */
    if (
      item.status === "served" ||
      item.status === "cancelled"
    ) {
      return res.status(400).json({
        message:
          "Không thể sửa món đã phục vụ hoặc đã hủy",
      });
    }

    /*
     * Cập nhật quantity
     */
    await item.update({
      quantity: Number(quantity),
    });

    /*
     * Cập nhật tổng tiền
     */
    await updateOrderTotal(
      order.id
    );

    return res.json(item);
  } catch (error: unknown) {
    console.error(
      "UPDATE ORDER ITEM ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể cập nhật món";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
 * DELETE ORDER ITEM
 * ===================================================== */

export const deleteOrderItem = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const id = Number(req.params.id);

    /*
     * Kiểm tra ID
     */
    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    /*
     * Tìm OrderItem
     */
    const item = await OrderItem.findByPk(id);

    if (!item) {
      return res.status(404).json({
        message:
          "OrderItem không tồn tại",
      });
    }

    /*
     * Tìm Order
     */
    const order = await Order.findByPk(
      item.order_id
    );

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /*
     * User chỉ được xóa món trong order của mình.
     */
    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa món trong order này",
      });
    }

    /*
     * Không cho xóa món đã phục vụ.
     */
    if (item.status === "served") {
      return res.status(400).json({
        message:
          "Không thể xóa món đã phục vụ",
      });
    }

    /*
     * Không cho xóa món đã hủy.
     */
    if (item.status === "cancelled") {
      return res.status(400).json({
        message:
          "Món đã được hủy",
      });
    }

    /*
     * Xóa OrderItem
     */
    await item.destroy();

    /*
     * Cập nhật tổng tiền
     */
    await updateOrderTotal(
      order.id
    );

    /*
     * Đồng bộ Order
     */
    await syncOrderStatus(
      order.id
    );

    return res.json({
      message:
        "Xóa món khỏi order thành công",
    });
  } catch (error: unknown) {
    console.error(
      "DELETE ORDER ITEM ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể xóa món";

    return res.status(500).json({
      message,
    });
  }
};

/* =====================================================
 * UPDATE ORDER ITEM STATUS
 *
 * Đây là hàm quan trọng nhất của KDS + ManageOrder.
 *
 * KITCHEN:
 * pending  → cooking
 * cooking  → ready
 *
 * WAITER:
 * ready → served
 *
 * ADMIN / CHAIN MANAGER / BRANCH MANAGER:
 * ready → served
 *
 * ADMIN / CHAIN MANAGER / BRANCH MANAGER:
 * pending → cancelled
 * cooking → cancelled
 * ready → cancelled
 * ===================================================== */

export const updateOrderItemStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /*
     * ===================================================
     * 1. KIỂM TRA ĐĂNG NHẬP
     * ===================================================
     */

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    /*
     * ===================================================
     * 2. LẤY ID + STATUS
     * ===================================================
     */

    const itemId = Number(
      req.params.id
    );

    const { status } = req.body;

    /*
     * Kiểm tra ID
     */
    if (!Number.isInteger(itemId)) {
      return res.status(400).json({
        message:
          "ID món không hợp lệ",
      });
    }

    /*
     * Kiểm tra status
     */
    if (!STATUS_LIST.includes(status)) {
      return res.status(400).json({
        message:
          "Trạng thái món không hợp lệ",
      });
    }

    /*
     * ===================================================
     * 3. KIỂM TRA ROLE
     * ===================================================
     */

    if (
      !STATUS_ROLES.includes(
        req.user.role
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền cập nhật trạng thái món",
      });
    }

    /*
     * ===================================================
     * 4. TÌM ORDER ITEM
     * ===================================================
     */

    const item =
      await OrderItem.findByPk(
        itemId
      );

    if (!item) {
      return res.status(404).json({
        message:
          "OrderItem không tồn tại",
      });
    }

    /*
     * ===================================================
     * 5. TÌM ORDER
     * ===================================================
     */

    const order =
      await Order.findByPk(
        item.order_id
      );

    if (!order) {
      return res.status(404).json({
        message:
          "Order không tồn tại",
      });
    }

    /*
     * ===================================================
     * 6. KIỂM TRA CHI NHÁNH
     *
     * Admin / Chain Manager:
     *   toàn hệ thống
     *
     * Branch Manager:
     *   chỉ branch của mình
     *
     * Kitchen / Waiter:
     *   chỉ branch của mình
     * ===================================================
     */

    const isGlobalRole =
      req.user.role === "admin" ||
      req.user.role ===
        "chain_manager";

    if (!isGlobalRole) {
      if (
        req.user.branchId ===
        null ||
        req.user.branchId ===
          undefined
      ) {
        return res.status(403).json({
          message:
            "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (
        req.user.branchId !==
        order.branch_id
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền thao tác đơn của chi nhánh này",
        });
      }
    }

    /*
     * ===================================================
     * 7. TRẠNG THÁI HIỆN TẠI
     * ===================================================
     */

    const currentStatus =
      item.status;

    /*
     * ===================================================
     * 8. KITCHEN FLOW
     *
     * Chỉ role kitchen được xử lý bếp.
     *
     * pending → cooking
     * cooking → ready
     * ===================================================
     */

    if (
      req.user.role ===
      "kitchen"
    ) {
      const validKitchenTransition =
        (currentStatus ===
          "pending" &&
          status ===
            "cooking") ||
        (currentStatus ===
          "cooking" &&
          status ===
            "ready");

      if (
        !validKitchenTransition
      ) {
        return res.status(403).json({
          message:
            "Nhân viên bếp chỉ được chuyển món từ Chờ chế biến → Đang chế biến → Đã làm xong",
        });
      }
    }

    /*
     * ===================================================
     * 9. WAITER FLOW
     *
     * ready → served
     * ===================================================
     */

    if (
      req.user.role ===
      "waiter"
    ) {
      const validWaiterTransition =
        currentStatus ===
          "ready" &&
        status === "served";

      if (
        !validWaiterTransition
      ) {
        return res.status(403).json({
          message:
            "Nhân viên phục vụ chỉ được chuyển món từ Đã làm xong → Đã phục vụ",
        });
      }
    }

    /*
     * ===================================================
     * 10. MANAGEMENT FLOW
     *
     * Admin
     * Chain Manager
     * Branch Manager
     *
     * ready → served
     *
     * pending → cancelled
     * cooking → cancelled
     * ready → cancelled
     * ===================================================
     */

    const isManagementRole =
      req.user.role === "admin" ||
      req.user.role === "chain_manager" ||
      req.user.role === "branch_manager";

    if (isManagementRole) {
      const validManagementTransition =
        // Luồng chính
        (currentStatus === "pending" && status === "cooking") ||
        (currentStatus === "cooking" && status === "ready") ||
        (currentStatus === "ready" && status === "served") ||

        // Hủy món
        (currentStatus === "pending" && status === "cancelled") ||
        (currentStatus === "cooking" && status === "cancelled") ||
        (currentStatus === "ready" && status === "cancelled");

      if (!validManagementTransition) {
        return res.status(403).json({
          message: "Không thể chuyển trạng thái món theo bước này",
        });
      }
    }

    /*
     * ===================================================
     * 11. CẬP NHẬT ORDER ITEM
     * ===================================================
     */

    await item.update({
      status,
    });

    /*
     * ===================================================
     * 12. ĐỒNG BỘ ORDER
     * ===================================================
     */

    await syncOrderStatus(
      order.id
    );

    /*
     * ===================================================
     * 13. REALTIME SOCKET
     * ===================================================
     */

    try {
      const io = getIO();

      /*
       * Thông báo OrderItem thay đổi
       */
      io.emit(
        "order-item-status-updated",
        {
          id: item.id,
          order_id:
            item.order_id,
          menu_item_id:
            item.menu_item_id,
          status:
            item.status,
        }
      );

      /*
       * Lấy Order mới nhất
       * sau khi syncOrderStatus()
       */
      const updatedOrder =
        await Order.findByPk(
          order.id
        );

      /*
       * Thông báo Order thay đổi
       */
      io.emit(
        "order-status-updated",
        {
          order_id:
            order.id,
          status:
            updatedOrder?.status,
        }
      );
    } catch (socketError) {
      /*
       * Socket lỗi không làm
       * request update thất bại.
       */
      console.warn(
        "SOCKET ORDER ITEM STATUS WARNING:",
        socketError
      );
    }

    /*
     * ===================================================
     * 14. RESPONSE
     * ===================================================
     */

    return res.status(200).json({
      message:
        "Cập nhật trạng thái món thành công",
      data: item,
    });
  } catch (error: unknown) {
    console.error(
      "UPDATE ORDER ITEM STATUS ERROR:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Không thể cập nhật trạng thái món";

    return res.status(500).json({
      message,
    });
  }
};