import { Response } from "express";
import { Op } from "sequelize";
import type { Transaction } from "sequelize";

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

/* =====================================================
 * CONSTANTS
 * ===================================================== */

const GLOBAL_ROLES = ["admin", "chain_manager"];

const MANAGER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const STAFF_ROLES = [
  "branch_manager",
  "waiter",
  "kitchen",
  "cashier",
];

const STATUS_LIST = [
  "pending",
  "cooking",
  "ready",
  "served",
  "cancelled",
] as const;

type ItemStatus = (typeof STATUS_LIST)[number];

type OrderStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled";

/* =====================================================
 * VALIDATION HELPERS
 * ===================================================== */

const isValidPositiveId = (value: unknown): boolean => {
  const numberValue = Number(value);

  return (
    Number.isInteger(numberValue) &&
    numberValue > 0
  );
};

const isValidQuantity = (value: unknown): boolean => {
  const numberValue = Number(value);

  return (
    Number.isInteger(numberValue) &&
    numberValue > 0
  );
};

const isGlobalRole = (role: string): boolean =>
  GLOBAL_ROLES.includes(role);

const isManagerRole = (role: string): boolean =>
  MANAGER_ROLES.includes(role);

/* =====================================================
 * PERMISSION HELPERS
 * ===================================================== */

const canAccessOrderBranch = (
  role: string,
  userBranchId: number | null | undefined,
  orderBranchId: number | null | undefined
): boolean => {
  if (isGlobalRole(role)) {
    return true;
  }

  if (!STAFF_ROLES.includes(role)) {
    return false;
  }

  if (
    userBranchId == null ||
    orderBranchId == null
  ) {
    return false;
  }

  const currentBranchId = Number(userBranchId);
  const targetBranchId = Number(orderBranchId);

  return (
    Number.isInteger(currentBranchId) &&
    currentBranchId > 0 &&
    Number.isInteger(targetBranchId) &&
    targetBranchId > 0 &&
    currentBranchId === targetBranchId
  );
};

const canAccessOrderItem = (
  role: string,
  userId: number,
  userBranchId: number | null | undefined,
  order: Order
): boolean => {
  if (isGlobalRole(role)) {
    return true;
  }

  if (STAFF_ROLES.includes(role)) {
    return canAccessOrderBranch(
      role,
      userBranchId,
      order.branch_id
    );
  }

  return (
    (role === "user" || role === "customer") &&
    Number(order.user_id) === Number(userId)
  );
};

/* =====================================================
 * ORDER HELPERS
 * ===================================================== */

/**
 * Tính tổng tiền.
 *
 * Không tính các món đã hủy.
 * Hàm này luôn chạy trong transaction của thao tác gọi nó.
 */
const updateOrderTotal = async (
  orderId: number,
  transaction: Transaction
): Promise<number> => {
  const items = await OrderItem.findAll({
    where: {
      order_id: orderId,
      status: {
        [Op.ne]: "cancelled",
      },
    },
    transaction,
  });

  const totalPrice = items.reduce(
    (sum, item) =>
      sum +
      Number(item.unit_price) *
        Number(item.quantity),
    0
  );

  await Order.update(
    {
      total_price: totalPrice,
    },
    {
      where: {
        id: orderId,
      },
      transaction,
    }
  );

  return totalPrice;
};

/**
 * Đồng bộ trạng thái Order theo trạng thái các món.
 */
const syncOrderStatus = async (
  orderId: number,
  transaction: Transaction
): Promise<OrderStatus> => {
  const items = await OrderItem.findAll({
    where: {
      order_id: orderId,
    },
    transaction,
  });

  let newStatus: OrderStatus = "pending";

  if (items.length > 0) {
    const statuses = items.map(
      (item) => item.status
    );

    const allCancelled = statuses.every(
      (status) => status === "cancelled"
    );

    const allFinished = statuses.every(
      (status) =>
        status === "served" ||
        status === "cancelled"
    );

    const hasServed = statuses.some(
      (status) => status === "served"
    );

    const hasStarted = statuses.some(
      (status) =>
        status === "cooking" ||
        status === "ready" ||
        status === "served"
    );

    if (allCancelled) {
      newStatus = "cancelled";
    } else if (allFinished && hasServed) {
      newStatus = "completed";
    } else if (hasStarted) {
      newStatus = "processing";
    }
  }

  await Order.update(
    {
      status: newStatus,
    },
    {
      where: {
        id: orderId,
      },
      transaction,
    }
  );

  return newStatus;
};

/**
 * Kiểm tra món ăn có được phép sử dụng
 * trong chi nhánh của Order không.
 *
 * branch_id = null: món dùng chung toàn chuỗi.
 */
const validateMenuItemForBranch = (
  menuItem: MenuItem,
  orderBranchId: number | null | undefined
): string | null => {
  if (
    menuItem.is_deleted === true ||
    menuItem.isActive === false
  ) {
    return "Món ăn hiện không còn kinh doanh";
  }

  if (
    menuItem.branch_id != null &&
    Number(menuItem.branch_id) !==
      Number(orderBranchId)
  ) {
    return "Món ăn không thuộc chi nhánh của đơn hàng";
  }

  return null;
};

/* =====================================================
 * SOCKET HELPER
 * ===================================================== */

/**
 * Phát sự kiện sau khi transaction đã commit.
 */

/* =====================================================
 * SOCKET HELPER
 * ===================================================== */

/**
 * Phát sự kiện sau khi transaction đã commit.
 * Chỉ gửi tới chi nhánh của Order và quản trị toàn hệ thống.
 */
const emitOrderItemChange = (
  eventName: string,
  item: OrderItem,
  orderId: number,
  orderStatus: OrderStatus,
  branchId: number | null | undefined
): void => {
  try {
    const io = getIO();

    const payload = {
      id: item.id,
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      status: item.status,
      order_status: orderStatus,
    };

    const rooms = branchId != null
      ? io.to(`branch:${branchId}`).to("role:global")
      : io.to("role:global");

    // Sự kiện nghiệp vụ cụ thể
    rooms.emit(eventName, payload);

    // Giữ sự kiện cũ để tương thích frontend
    if (
      eventName !== "order-item-status-updated"
    ) {
      rooms.emit(
        "order-item-status-updated",
        payload
      );
    }

    // Cập nhật trạng thái Order
    rooms.emit("order-status-updated", {
      order_id: orderId,
      status: orderStatus,
    });
  } catch (error) {
    console.warn(
      "ORDER ITEM SOCKET WARNING:",
      error
    );
  }
};


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
            is_deleted: false,
          },
          required: true,
        },
        {
          model: MenuItem,
          as: "menu",
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json(data);
  } catch (error: unknown) {
    console.error(
      "GET MY ORDER ITEMS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể lấy danh sách món",
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

  if (
    !isValidPositiveId(order_id) ||
    !isValidPositiveId(menu_item_id)
  ) {
    return res.status(400).json({
      message:
        "Order ID hoặc Menu Item ID không hợp lệ",
    });
  }

  if (!isValidQuantity(quantity)) {
    return res.status(400).json({
      message:
        "Quantity phải là số nguyên lớn hơn 0",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    /*
     * Khóa Order trước để thống nhất thứ tự khóa
     * với các thao tác cập nhật OrderItem.
     */
    const order = await Order.findByPk(
      Number(order_id),
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!order || order.is_deleted) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    const role = req.user.role;

    const canAddItem =
      isGlobalRole(role) ||
      (
        (role === "branch_manager" ||
          role === "waiter") &&
        canAccessOrderBranch(
          role,
          req.user.branchId,
          order.branch_id
        )
      ) ||
      (
        (role === "user" ||
          role === "customer") &&
        Number(order.user_id) ===
          Number(req.user.id)
      );

    if (!canAddItem) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền thêm món vào Order này",
      });
    }

    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Không thể thêm món vào Order đã hoàn tất hoặc đã hủy",
      });
    }

    const menuItem = await MenuItem.findByPk(
      Number(menu_item_id),
      {
        transaction,
      }
    );

    if (!menuItem) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Món ăn không tồn tại",
      });
    }

    const menuError = validateMenuItemForBranch(
      menuItem,
      order.branch_id
    );

    if (menuError) {
      await transaction.rollback();

      return res.status(400).json({
        message: menuError,
      });
    }

    const item = await OrderItem.create(
      {
        order_id: order.id,
        menu_item_id: Number(menu_item_id),
        quantity: Number(quantity),
        unit_price: Number(menuItem.price),
        status: "pending",
      },
      {
        transaction,
      }
    );

    const totalPrice = await updateOrderTotal(
      order.id,
      transaction
    );

    const orderStatus = await syncOrderStatus(
      order.id,
      transaction
    );

    await transaction.commit();

    emitOrderItemChange(
      "order-item-created",
      item,
      order.id,
      orderStatus,
      order.branch_id ?? null
    );

    return res.status(201).json({
      message: "Thêm món vào Order thành công",
      data: item,
      total_price: totalPrice,
      order_status: orderStatus,
    });
  } catch (error: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction có thể đã kết thúc.
    }

    console.error(
      "CREATE ORDER ITEM ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể tạo món trong Order",
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
  if (!req.user) {
    return res.status(401).json({
      message: "Chưa đăng nhập",
    });
  }

  const id = Number(req.params.id);
  const { quantity } = req.body;

  if (!isValidPositiveId(id)) {
    return res.status(400).json({
      message: "ID món không hợp lệ",
    });
  }

  if (!isValidQuantity(quantity)) {
    return res.status(400).json({
      message:
        "Quantity phải là số nguyên lớn hơn 0",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    /*
     * Đọc item để xác định Order cha.
     * Sau đó khóa Order trước rồi mới khóa item.
     */
    const initialItem = await OrderItem.findByPk(
      id,
      {
        transaction,
      }
    );

    if (!initialItem) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không tồn tại",
      });
    }

    const order = await Order.findByPk(
      initialItem.order_id,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!order || order.is_deleted) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    const item = await OrderItem.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !item ||
      item.order_id !== order.id
    ) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không còn tồn tại",
      });
    }

    const role = req.user.role;

    if (
      !canAccessOrderItem(
        role,
        req.user.id,
        req.user.branchId,
        order
      )
    ) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền sửa món trong Order này",
      });
    }

    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Không thể sửa món trong Order đã hoàn tất hoặc đã hủy",
      });
    }

    /*
     * Chỉ cho sửa số lượng khi món chưa bắt đầu chế biến.
     * Tránh thay đổi số lượng sau khi bếp đã tiếp nhận món.
     */
    if (item.status !== "pending") {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Chỉ được sửa số lượng món khi món đang ở trạng thái chờ chế biến",
      });
    }

    await item.update(
      {
        quantity: Number(quantity),
      },
      {
        transaction,
      }
    );

    const totalPrice = await updateOrderTotal(
      order.id,
      transaction
    );

    const orderStatus = await syncOrderStatus(
      order.id,
      transaction
    );

    await transaction.commit();

    emitOrderItemChange(
      "order-item-updated",
      item,
      order.id,
      orderStatus,
      order.branch_id ?? null
    );

    return res.status(200).json({
      message: "Cập nhật số lượng món thành công",
      data: item,
      total_price: totalPrice,
      order_status: orderStatus,
    });
  } catch (error: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction có thể đã kết thúc.
    }

    console.error(
      "UPDATE ORDER ITEM ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể cập nhật món",
    });
  }
};

/* =====================================================
 * DELETE ORDER ITEM
 * ===================================================== */

/**
 * Không xóa vật lý.
 * Chuyển món sang cancelled để giữ lịch sử.
 */
export const deleteOrderItem = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Chưa đăng nhập",
    });
  }

  const id = Number(req.params.id);

  if (!isValidPositiveId(id)) {
    return res.status(400).json({
      message: "ID món không hợp lệ",
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const initialItem = await OrderItem.findByPk(
      id,
      {
        transaction,
      }
    );

    if (!initialItem) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không tồn tại",
      });
    }

    const order = await Order.findByPk(
      initialItem.order_id,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!order || order.is_deleted) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    const item = await OrderItem.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (
      !item ||
      item.order_id !== order.id
    ) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không còn tồn tại",
      });
    }

    if (!isManagerRole(req.user.role)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Chỉ quản lý mới được phép hủy món",
      });
    }

    if (
      !canAccessOrderBranch(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền thao tác Order của chi nhánh khác",
      });
    }

    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Không thể hủy món trong Order đã hoàn tất hoặc đã hủy",
      });
    }

    if (item.status === "served") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Không thể hủy món đã phục vụ",
      });
    }

    if (item.status === "cancelled") {
      await transaction.rollback();

      return res.status(400).json({
        message: "Món đã được hủy trước đó",
      });
    }

    await item.update(
      {
        status: "cancelled",
      },
      {
        transaction,
      }
    );

    const totalPrice = await updateOrderTotal(
      order.id,
      transaction
    );

    const orderStatus = await syncOrderStatus(
      order.id,
      transaction
    );

    await transaction.commit();

    emitOrderItemChange(
      "order-item-deleted",
      item,
      order.id,
      orderStatus,
      order.branch_id ?? null
    );

    return res.status(200).json({
      message: "Hủy món thành công",
      data: item,
      total_price: totalPrice,
      order_status: orderStatus,
    });
  } catch (error: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction có thể đã kết thúc.
    }

    console.error(
      "DELETE ORDER ITEM ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể hủy món",
    });
  }
};

/* =====================================================
 * UPDATE ORDER ITEM STATUS
 * ===================================================== */

export const updateOrderItemStatus = async (
  req: AuthRequest,
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Chưa đăng nhập",
    });
  }

  const itemId = Number(req.params.id);
  const statusValue: unknown = req.body.status;

  if (!isValidPositiveId(itemId)) {
    return res.status(400).json({
      message: "ID món không hợp lệ",
    });
  }

  if (
    typeof statusValue !== "string" ||
    !STATUS_LIST.includes(statusValue as ItemStatus)
  ) {
    return res.status(400).json({
      message: "Trạng thái món không hợp lệ",
    });
  }

  const status = statusValue as ItemStatus;
  const transaction = await sequelize.transaction();

  try {
    const initialItem = await OrderItem.findByPk(
      itemId,
      {
        transaction,
      }
    );

    if (!initialItem) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không tồn tại",
      });
    }

    const order = await Order.findByPk(
      initialItem.order_id,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!order || order.is_deleted) {
      await transaction.rollback();

      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    const item = await OrderItem.findByPk(
      itemId,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (
      !item ||
      item.order_id !== order.id
    ) {
      await transaction.rollback();

      return res.status(404).json({
        message: "OrderItem không còn tồn tại",
      });
    }

    const role = req.user.role;

    if (
      !canAccessOrderBranch(
        role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền thao tác đơn của chi nhánh này",
      });
    }

    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Không thể cập nhật món trong Order đã hoàn tất hoặc đã hủy",
      });
    }

    const currentStatus = item.status;

    const validKitchenTransition =
      (
        currentStatus === "pending" &&
        status === "cooking"
      ) ||
      (
        currentStatus === "cooking" &&
        status === "ready"
      );

    const validServingTransition =
      currentStatus === "ready" &&
      status === "served";

    const validCancelTransition =
      (
        currentStatus === "pending" ||
        currentStatus === "cooking" ||
        currentStatus === "ready"
      ) &&
      status === "cancelled";

    let isAllowedTransition = false;

    // Chỉ bếp được cập nhật trạng thái chế biến.
    if (role === "kitchen") {
      isAllowedTransition = validKitchenTransition;
    }
    // Chỉ waiter được xác nhận món đã phục vụ.
    else if (role === "waiter") {
      isAllowedTransition = validServingTransition;
    }
    // Quản lý chỉ được hủy món.
    else if (isManagerRole(role)) {
      isAllowedTransition = validCancelTransition;
    }

    if (!isAllowedTransition) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền chuyển trạng thái món theo bước này",
      });
    }

    /*
     * Xuất kho trong cùng transaction với thao tác served.
     */
    if (
      currentStatus === "ready" &&
      status === "served"
    ) {
      const branchId = Number(order.branch_id);

      if (
        order.branch_id == null ||
        !Number.isInteger(branchId) ||
        branchId <= 0
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "Đơn hàng chưa được gán chi nhánh hợp lệ",
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
        transaction
      );
    }

    await item.update(
      {
        status,
      },
      {
        transaction,
      }
    );

    const totalPrice = await updateOrderTotal(
      order.id,
      transaction
    );

    const orderStatus = await syncOrderStatus(
      order.id,
      transaction
    );

    await item.reload({
      transaction,
    });

    await transaction.commit();

    emitOrderItemChange(
      "order-item-status-updated",
      item,
      order.id,
      orderStatus,
      order.branch_id ?? null
    );

    return res.status(200).json({
      message: "Cập nhật trạng thái món thành công",
      data: item,
      total_price: totalPrice,
      order_status: orderStatus,
    });
  } catch (error: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction có thể đã kết thúc.
    }

    if (error instanceof InventoryConsumptionError) {
      return res.status(400).json({
        message: error.message,
      });
    }

    console.error(
      "UPDATE ORDER ITEM STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Lỗi server khi cập nhật trạng thái món",
    });
  }
};