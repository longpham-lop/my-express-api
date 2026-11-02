import { Response } from "express";

import Order from "../models/Order";
import Reservation from "../models/Reservation";
import OrderItem from "../models/OrderItem";
import MenuItem from "../models/Menu";
import Branch from "../models/Branch";

import sequelize from "../config/db";

import { AuthRequest } from "../middlewares/auth.middleware";
import { getIO } from "../socket";

/* =====================================================
 * CONSTANTS
 * ===================================================== */

const GLOBAL_ROLES = [
  "admin",
  "chain_manager",
];

const ORDER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
  "cashier",
];

const MANAGER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

/* =====================================================
 * ROLE HELPERS
 * ===================================================== */

const isGlobalRole = (
  role?: string
): boolean => {
  return (
    !!role &&
    GLOBAL_ROLES.includes(role)
  );
};

const canManageOrders = (
  role?: string
): boolean => {
  return (
    !!role &&
    ORDER_ROLES.includes(role)
  );
};

const isManagerRole = (
  role?: string
): boolean => {
  return (
    !!role &&
    MANAGER_ROLES.includes(role)
  );
};

/* =====================================================
 * VALIDATION HELPERS
 * ===================================================== */

const isValidPositiveId = (
  value: unknown
): boolean => {
  const numberValue = Number(value);

  return (
    Number.isInteger(numberValue) &&
    numberValue > 0
  );
};

/* =====================================================
 * BRANCH PERMISSION
 * ===================================================== */

const canAccessBranch = (
  role: string,
  userBranchId: number | null | undefined,
  orderBranchId: number | null | undefined
): boolean => {
  if (isGlobalRole(role)) {
    return true;
  }

  if (
    role !== "branch_manager" &&
    role !== "waiter" &&
    role !== "cashier"
  ) {
    return false;
  }

  if (
    userBranchId == null ||
    orderBranchId == null
  ) {
    return false;
  }

  const currentBranchId =
    Number(userBranchId);

  const targetBranchId =
    Number(orderBranchId);

  return (
    Number.isInteger(currentBranchId) &&
    currentBranchId > 0 &&
    Number.isInteger(targetBranchId) &&
    targetBranchId > 0 &&
    currentBranchId === targetBranchId
  );
};

/* =====================================================
 * SOCKET HELPER
 * ===================================================== */


/* =====================================================
 * SOCKET HELPER
 * ===================================================== */

const emitOrderUpdated = (
  orderId: number,
  status: string,
  branchId: number | null | undefined
): void => {
  try {
    const io = getIO();

    const rooms = branchId != null
      ? io.to(`branch:${branchId}`).to("role:global")
      : io.to("role:global");

    rooms.emit("order-status-updated", {
      order_id: orderId,
      status,
    });

    rooms.emit("order-item-status-updated", {
      order_id: orderId,
      status,
    });
  } catch (error) {
    console.warn(
      "ORDER SOCKET WARNING:",
      error
    );
  }
};

/* =====================================================
 * GET ALL ORDERS
 * ===================================================== */

/**
 * GET /api/orders
 *
 * Admin / Chain Manager:
 * - Xem toàn bộ đơn hàng.
 *
 * Branch Manager / Waiter / Cashier:
 * - Chỉ xem đơn của chi nhánh mình.
 *
 * User / Customer:
 * - Chỉ xem đơn của chính mình.
 */
export const getAllOrders = async (
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
      id,
      role,
      branchId,
    } = req.user;

    if (canManageOrders(role)) {
      const whereCondition: Record<
        string,
        unknown
      > = {
        is_deleted: false,
      };

      if (!isGlobalRole(role)) {
        if (branchId == null) {
          return res.status(403).json({
            message:
              "Tài khoản chưa được gán chi nhánh",
          });
        }

        whereCondition.branch_id =
          Number(branchId);
      }

      const orders = await Order.findAll({
        where: whereCondition,

        order: [
          ["createdAt", "DESC"],
        ],

        include: [
          {
            model: OrderItem,
            as: "items",
            include: [
              {
                model: MenuItem,
                as: "menu",
                attributes: [
                  "id",
                  "name",
                  "price",
                  "image",
                ],
              },
            ],
          },

          {
            model: Branch,
            as: "branch",
            attributes: [
              "id",
              "name",
              "code",
            ],
            required: false,
          },
        ],
      });

      return res.status(200).json(orders);
    }

    /*
     * Customer chỉ xem đơn của chính mình.
     */
    if (
      role !== "user" &&
      role !== "customer"
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem danh sách đơn hàng",
      });
    }

    const orders = await Order.findAll({
      where: {
        user_id: id,
        is_deleted: false,
      },

      order: [
        ["createdAt", "DESC"],
      ],

      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: [
                "id",
                "name",
                "price",
                "image",
              ],
            },
          ],
        },

        {
          model: Branch,
          as: "branch",
          attributes: [
            "id",
            "name",
            "code",
          ],
          required: false,
        },
      ],
    });

    return res.status(200).json(orders);
  } catch (error: unknown) {
    console.error(
      "GET ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể lấy danh sách đơn hàng",
    });
  }
};

/* =====================================================
 * GET ORDER BY ID
 * ===================================================== */

/**
 * GET /api/orders/:id
 */
export const getOrderById = async (
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

    if (!isValidPositiveId(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: [
                "id",
                "name",
                "price",
                "image",
              ],
              required: false,
            },
          ],
        },

        {
          model: Branch,
          as: "branch",
          attributes: [
            "id",
            "name",
            "code",
          ],
          required: false,
        },
      ],
    });

    if (!order || order.is_deleted) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    const role = req.user.role;

    if (isGlobalRole(role)) {
      return res.status(200).json(order);
    }

    if (canManageOrders(role)) {
      const allowed = canAccessBranch(
        role,
        req.user.branchId,
        order.branch_id
      );

      if (!allowed) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xem Order của chi nhánh khác",
        });
      }

      return res.status(200).json(order);
    }

    if (
      role !== "user" &&
      role !== "customer"
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem Order này",
      });
    }

    if (
      Number(order.user_id) !==
      Number(req.user.id)
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem Order của người khác",
      });
    }

    return res.status(200).json(order);
  } catch (error: unknown) {
    console.error(
      "GET ORDER DETAIL ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể lấy chi tiết Order",
    });
  }
};

/*
 * Tương thích với endpoint cũ.
 *
 * Endpoint cũ vẫn phải gắn authMiddleware.
 */
export const getOrderDetail = getOrderById;

/* =====================================================
 * CREATE ORDER
 * ===================================================== */

/**
 * POST /api/orders
 *
 * Nếu có reservation_id:
 * - Lấy branch_id từ Reservation.
 *
 * Nếu là nhân viên chi nhánh:
 * - Lấy branch_id từ JWT.
 *
 * total_price luôn bắt đầu bằng 0.
 * Backend sẽ tính lại khi thêm OrderItem.
 */
export const createOrder = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const reservationId =
      req.body.reservation_id;

    if (
      reservationId != null &&
      !isValidPositiveId(reservationId)
    ) {
      return res.status(400).json({
        message:
          "Reservation ID không hợp lệ",
      });
    }

    let finalBranchId:
      number | null = null;

    let reservation:
      | Reservation
      | null = null;

    if (reservationId != null) {
      reservation =
        await Reservation.findByPk(
          Number(reservationId)
        );

      if (!reservation) {
        return res.status(404).json({
          message:
            "Reservation không tồn tại",
        });
      }

      finalBranchId =
        reservation.branch_id ?? null;
    }

    const role = req.user.role;

    /*
     * Nhân viên chi nhánh phải sử dụng
     * Reservation thuộc đúng chi nhánh.
     */
    if (
      reservation &&
      canManageOrders(role) &&
      !isGlobalRole(role)
    ) {
      if (
        req.user.branchId == null ||
        Number(reservation.branch_id) !==
          Number(req.user.branchId)
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền tạo Order cho Reservation thuộc chi nhánh khác",
        });
      }
    }

    /*
     * Nếu chưa lấy được branch từ Reservation,
     * sử dụng branch trong JWT.
     */
    if (
      finalBranchId == null &&
      req.user.branchId != null
    ) {
      finalBranchId =
        Number(req.user.branchId);
    }

    /*
     * Nhân viên chi nhánh bắt buộc có branch.
     */
    if (
      canManageOrders(role) &&
      !isGlobalRole(role) &&
      finalBranchId == null
    ) {
      return res.status(403).json({
        message:
          "Tài khoản chưa được gán chi nhánh",
      });
    }

    const order = await Order.create({
      branch_id: finalBranchId,
      user_id: req.user.id,
      reservation_id:
        reservation?.id ?? null,
      total_price: 0,
      status: "pending",
      is_deleted: false,
    });

    emitOrderUpdated(
      order.id,
      order.status,
      order.branch_id ?? null
    );

    return res.status(201).json({
      message: "Tạo Order thành công",
      data: order,
    });
  } catch (error: unknown) {
    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể tạo Order",
    });
  }
};

/* =====================================================
 * UPDATE ORDER STATUS
 * ===================================================== */

/**
 * PUT /api/orders/:id/status
 *
 * API này chỉ cho phép hủy Order.
 *
 * processing và completed được đồng bộ
 * tự động từ OrderItem.
 */
export const updateOrderStatus = async (
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
      message: "ID không hợp lệ",
    });
  }

  if (!isManagerRole(req.user.role)) {
    return res.status(403).json({
      message:
        "Bạn không có quyền hủy Order",
    });
  }

  if (req.body.status !== "cancelled") {
    return res.status(400).json({
      message:
        "Trạng thái Order được đồng bộ tự động. API này chỉ hỗ trợ hủy Order.",
    });
  }

  const transaction =
    await sequelize.transaction();

  try {
    const order = await Order.findByPk(
      id,
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

    if (
      !canAccessBranch(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền hủy Order của chi nhánh khác",
      });
    }

    if (
      order.status === "completed" ||
      order.status === "cancelled"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Không thể hủy Order đã hoàn tất hoặc đã hủy",
      });
    }

    const items = await OrderItem.findAll({
      where: {
        order_id: order.id,
      },

      transaction,

      lock: transaction.LOCK.UPDATE,
    });

    /*
     * Không cho hủy toàn bộ đơn
     * nếu đã có món được phục vụ.
     */
    const hasServedItem = items.some(
      (item) => item.status === "served"
    );

    if (hasServedItem) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Order đã có món được phục vụ. Không thể hủy toàn bộ Order.",
      });
    }

    /*
     * Chuyển tất cả món chưa phục vụ
     * sang trạng thái cancelled.
     */
    for (const item of items) {
      if (item.status !== "cancelled") {
        await item.update(
          {
            status: "cancelled",
          },
          {
            transaction,
          }
        );
      }
    }

    await order.update(
      {
        status: "cancelled",
        total_price: 0,
      },
      {
        transaction,
      }
    );

    /*
     * Đồng bộ Reservation.
     */
    if (order.reservation_id) {
      const reservation =
        await Reservation.findByPk(
          order.reservation_id,
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

      if (reservation) {
        await reservation.update(
          {
            status: "cancelled",
          },
          {
            transaction,
          }
        );
      }
    }

    await transaction.commit();

    emitOrderUpdated(
      order.id,
      "cancelled",
      order.branch_id ?? null
    );

    return res.status(200).json({
      message: "Hủy Order thành công",

      order: {
        id: order.id,
        status: "cancelled",
        total_price: 0,
      },
    });
  } catch (error: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction có thể đã kết thúc.
    }

    console.error(
      "UPDATE ORDER STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể hủy Order",
    });
  }
};

/* =====================================================
 * DELETE ORDER
 * ===================================================== */

/**
 * DELETE /api/orders/:id
 *
 * Chỉ cho phép quản lý.
 * Chỉ xóa mềm đơn đã hoàn thành hoặc đã hủy.
 */
export const deleteOrder = async (
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
      message: "ID không hợp lệ",
    });
  }

  if (!isManagerRole(req.user.role)) {
    return res.status(403).json({
      message:
        "Bạn không có quyền xóa Order",
    });
  }

  const transaction =
    await sequelize.transaction();

  try {
    const order = await Order.findByPk(
      id,
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

    if (
      !canAccessBranch(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền xóa Order của chi nhánh khác",
      });
    }

    if (
      order.status !== "completed" &&
      order.status !== "cancelled"
    ) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "Chỉ được xóa Order đã hoàn thành hoặc đã hủy",
      });
    }

    await order.update(
      {
        is_deleted: true,
      },
      {
        transaction,
      }
    );

    await transaction.commit();

    emitOrderUpdated(
      order.id,
      order.status,
      order.branch_id ?? null
    );

    return res.status(200).json({
      message: "Xóa Order thành công",
    });
  } catch (error: unknown) {
    try {
      await transaction.rollback();
    } catch {
      // Transaction có thể đã kết thúc.
    }

    console.error(
      "DELETE ORDER ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể xóa Order",
    });
  }
};

/* =====================================================
 * GET MY ORDERS
 * ===================================================== */

/**
 * GET /api/orders/my
 */
export const getMyOrders = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const orders = await Order.findAll({
      where: {
        user_id: req.user.id,
        is_deleted: false,
      },

      order: [
        ["createdAt", "DESC"],
      ],

      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: [
                "id",
                "name",
                "price",
                "image",
              ],
            },
          ],
        },
      ],
    });

    return res.status(200).json(orders);
  } catch (error: unknown) {
    console.error(
      "GET MY ORDERS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        error instanceof Error
          ? error.message
          : "Không thể lấy danh sách Order",
    });
  }
};