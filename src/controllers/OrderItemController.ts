import { Response } from "express";

import OrderItem from "../models/OrderItem";
import Order from "../models/Order";
import MenuItem from "../models/Menu";
import sequelize from "../config/db";

import {
  consumeInventoryForOrderItem,
  InventoryConsumptionError,
} from "../services/InventoryConsumptionService";

import { AuthRequest } from "../middlewares/auth.middleware";
import { getIO } from "../socket";


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

const syncOrderStatus = async (order_id: number) => {
  const items = await OrderItem.findAll({
    where: {
      order_id,
    },
  });

  if (items.length === 0) {
    return;
  }

  const statuses = items.map((item) => item.status);

  const allCancelled = statuses.every(
    (itemStatus) => itemStatus === "cancelled"
  );

  const allFinished = statuses.every(
    (itemStatus) =>
      itemStatus === "served" ||
      itemStatus === "cancelled"
  );

  const hasServed = statuses.some(
    (itemStatus) => itemStatus === "served"
  );

  let newOrderStatus:
    | "pending"
    | "processing"
    | "completed"
    | "cancelled"
    | null = null;

  if (allCancelled) {
    newOrderStatus = "cancelled";
  } else if (allFinished && hasServed) {
    newOrderStatus = "completed";
  } else if (
    statuses.some(
      (itemStatus) =>
        itemStatus === "cooking" ||
        itemStatus === "ready" ||
        itemStatus === "served"
    )
  ) {
    newOrderStatus = "processing";
  } else if (
    statuses.every((itemStatus) => itemStatus === "pending")
  ) {
    newOrderStatus = "pending";
  }

  if (newOrderStatus !== null) {
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

export const updateOrderItemStatus = async (
  req: AuthRequest,
  res: Response
) => {
  const transaction = await sequelize.transaction();

  try {
    // =====================================================
    // 1. KIỂM TRA ĐĂNG NHẬP
    // =====================================================

    if (!req.user) {
      await transaction.rollback();

      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    // =====================================================
    // 2. LẤY ID + STATUS
    // =====================================================

    const itemId = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(itemId)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "ID món không hợp lệ",
      });
    }

    if (!STATUS_LIST.includes(status)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Trạng thái món không hợp lệ",
      });
    }

    // =====================================================
    // 3. TÌM ORDER ITEM
    // =====================================================

    const item = await OrderItem.findByPk(
      itemId,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!item) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không tồn tại",
      });
    }

    // =====================================================
    // 4. TÌM ORDER
    // =====================================================

    const order = await Order.findByPk(item.order_id, {
      transaction,
    });

    if (!order) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    
    // =====================================================
    // 5. KIỂM TRA CHI NHÁNH
    // =====================================================

    const isGlobalRole =
      req.user.role === "admin" ||
      req.user.role === "chain_manager";

    if (!isGlobalRole) {
      const userBranchId = Number(req.user.branchId);
      const orderBranchId = Number(order.branch_id);

      if (
        req.user.branchId == null ||
        !Number.isInteger(userBranchId) ||
        userBranchId <= 0
      ) {
        await transaction.rollback();

        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (
        !Number.isInteger(orderBranchId) ||
        orderBranchId <= 0 ||
        userBranchId !== orderBranchId
      ) {
        await transaction.rollback();

        return res.status(403).json({
          message:
            "Bạn không có quyền thao tác đơn của chi nhánh này",
        });
      }
    }



    // =====================================================
    // 6. LẤY TRẠNG THÁI HIỆN TẠI
    // =====================================================

    const currentStatus = item.status;

    // =====================================================
    // 7. KITCHEN FLOW
    // =====================================================

    // Các luồng chuyển trạng thái hợp lệ
    const validKitchenTransition =
      (currentStatus === "pending" && status === "cooking") ||
      (currentStatus === "cooking" && status === "ready");

    const validServingTransition =
      currentStatus === "ready" && status === "served";

    const validCancelTransition =
      (currentStatus === "pending" ||
        currentStatus === "cooking" ||
        currentStatus === "ready") &&
      status === "cancelled";

    const role = req.user.role;

    let isAllowedTransition = false;

    if (role === "kitchen") {
      // Bếp: Chờ chế biến → Đang chế biến → Đã làm xong
      isAllowedTransition = validKitchenTransition;
    } else if (role === "waiter") {
      // Phục vụ: Đã làm xong → Đã phục vụ
      isAllowedTransition = validServingTransition;
    } else if (
      role === "admin" ||
      role === "chain_manager" ||
      role === "branch_manager"
    ) {
      // Admin và quản lý được thao tác luồng bếp,
      // luồng phục vụ và hủy món trước khi phục vụ.
      isAllowedTransition =
        validKitchenTransition ||
        validServingTransition ||
        validCancelTransition;
    }

    if (!isAllowedTransition) {
      await transaction.rollback();

      return res.status(403).json({
        message: "Bạn không có quyền chuyển trạng thái món theo bước này",
      });
    }

    // =====================================================
    // 10. XUẤT KHO KHI READY → SERVED
    // =====================================================
    
   if (currentStatus === "ready" && status === "served") {
    const branchId = Number(order.branch_id);

    if (
      order.branch_id === null ||
      order.branch_id === undefined ||
      !Number.isInteger(branchId) ||
      branchId <= 0
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message: "Đơn hàng chưa được gán chi nhánh hợp lệ",
      });
    }

    await consumeInventoryForOrderItem(
      {
        orderItemId: item.id,
        orderId: order.id,
        branchId,
        menuItemId: item.menu_item_id,
        orderItemQuantity: Number(item.quantity),
        createdBy: req.user.id,
      },
      transaction,
    );
  }
    // =====================================================
    // 11. UPDATE ORDER ITEM
    // =====================================================

    await item.update(
      {
        status,
      },
      {
        transaction,
      }
    );

    
    // =====================================================
    // 12. ĐỒNG BỘ ORDER STATUS
    // =====================================================

    const items = await OrderItem.findAll({
      where: {
        order_id: order.id,
      },
      transaction,
    });

    if (items.length > 0) {
      const statuses = items.map(
        (orderItem) => orderItem.status,
      );

      const allCancelled = statuses.every(
        (itemStatus) => itemStatus === "cancelled",
      );

      const allFinished = statuses.every(
        (itemStatus) =>
          itemStatus === "served" ||
          itemStatus === "cancelled",
      );

      const hasServed = statuses.some(
        (itemStatus) => itemStatus === "served",
      );

      let newOrderStatus:
        | "pending"
        | "processing"
        | "completed"
        | "cancelled"
        | null = null;

      if (allCancelled) {
        newOrderStatus = "cancelled";
      } else if (allFinished && hasServed) {
        newOrderStatus = "completed";
      } else if (
        statuses.some(
          (itemStatus) =>
            itemStatus === "cooking" ||
            itemStatus === "ready" ||
            itemStatus === "served",
        )
      ) {
        newOrderStatus = "processing";
      } else if (
        statuses.every(
          (itemStatus) => itemStatus === "pending",
        )
      ) {
        newOrderStatus = "pending";
      }

      if (newOrderStatus !== null) {
        await order.update(
          {
            status: newOrderStatus,
          },
          {
            transaction,
          },
        );
      }
    }


    // =====================================================
    // 13. COMMIT
    // =====================================================

    await transaction.commit();

    // =====================================================
    // 14. REALTIME KDS
    // =====================================================

    try {
      const io = getIO();

      io.emit(
        "order-item-status-updated",
        {
          id: item.id,

          order_id:
            item.order_id,

          menu_item_id:
            item.menu_item_id,

          status: item.status,
        }
      );

      const updatedOrder =
        await Order.findByPk(order.id);

      io.emit(
        "order-status-updated",
        {
          order_id: order.id,

          status:
            updatedOrder?.status,
        }
      );
    } catch (socketError) {
      console.warn(
        "SOCKET ORDER ITEM STATUS WARNING:",
        socketError
      );
    }

    // =====================================================
    // 15. RESPONSE
    // =====================================================

    return res.status(200).json({
      message:
        "Cập nhật trạng thái món thành công",

      data: item,
    });
        } catch (error: unknown) {
      try {
        await transaction.rollback();
      } catch {
        // Giao dịch có thể đã kết thúc trước đó.
      }

      // =====================================================
      // INVENTORY ERROR
      // =====================================================

      if (error instanceof InventoryConsumptionError) {
        return res.status(400).json({
          message: error.message,
        });
      }

      console.error(
        "Lỗi cập nhật trạng thái món ăn:",
        error,
      );

      return res.status(500).json({
        message: "Lỗi server khi cập nhật trạng thái món ăn",
      });
    }
  }