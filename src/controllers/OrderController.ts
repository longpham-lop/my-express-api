import { Request, Response } from "express";

import Order from "../models/Order";
import Reservation from "../models/Reservation";
import OrderItem from "../models/OrderItem";
import MenuItem from "../models/Menu";
import TableModel from "../models/Table";
import Branch from "../models/Branch";

import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];

const ORDER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
  "cashier",
];

const isGlobalRole = (role?: string) => {
  return !!role && GLOBAL_ROLES.includes(role);
};

const canManageOrders = (role?: string) => {
  return !!role && ORDER_ROLES.includes(role);
};

/**
 * Kiểm tra Branch Manager có đang truy cập đúng chi nhánh không.
 */
const canAccessBranch = (
  role: string,
  userBranchId: number | null | undefined,
  orderBranchId: number | null | undefined
) => {
  if (isGlobalRole(role)) {
    return true;
  }

  if (role === "branch_manager") {
    return (
      userBranchId !== null &&
      userBranchId !== undefined &&
      orderBranchId === userBranchId
    );
  }

  return true;
};

/**
 * GET /api/orders
 *
 * admin / chain_manager:
 *   xem tất cả
 *
 * branch_manager:
 *   chỉ xem order của chi nhánh mình
 *
 * waiter / cashier:
 *   chỉ xem order của chi nhánh mình
 *
 * user:
 *   chỉ xem order của chính mình
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

    const { id, role, branchId } = req.user;

    if (canManageOrders(role)) {
      const whereCondition: Record<string, unknown> = {
        is_deleted: false,
      };

      if (!isGlobalRole(role)) {
        if (!branchId) {
          return res.status(403).json({
            message: "Tài khoản chưa được gán chi nhánh",
          });
        }

        whereCondition.branch_id = branchId;
      }

      const orders = await Order.findAll({
        where: whereCondition,
        order: [["createdAt", "DESC"]],

        include: [
          {
            model: OrderItem,
            as: "items",
            include: [
              {
                model: MenuItem,
                as: "menu",
                attributes: ["id", "name", "price", "image"],
              },
            ],
          },
          {
            model: Branch,
            as: "branch",
            attributes: ["id", "name", "code"],
            required: false,
          },
        ],
      });

      return res.json(orders);
    }

    /**
     * User/customer:
     * chỉ xem order của chính mình.
     */
    const orders = await Order.findAll({
      where: {
        user_id: id,
        is_deleted: false,
      },
      order: [["createdAt", "DESC"]],

      include: [
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: MenuItem,
              as: "menu",
              attributes: ["id", "name", "price", "image"],
            },
          ],
        },
        {
          model: Branch,
          as: "branch",
          attributes: ["id", "name", "code"],
        },
      ],
    });

    return res.json(orders);
  } catch (err: unknown) {
    console.error("GET ORDERS ERROR:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Không thể lấy danh sách đơn hàng";

    return res.status(500).json({
      message,
    });
  }
};

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

    if (isNaN(id)) {
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
              attributes: ["id", "name", "price", "image"],
              required: false,
            },
          ],
        },
        {
          model: Branch,
          as: "branch",
          attributes: ["id", "name", "code"],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /**
     * Không cho xem order đã soft delete.
     */
    if (order.is_deleted) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /**
     * Admin / Chain Manager
     */
    if (isGlobalRole(req.user.role)) {
      return res.json(order);
    }

    /**
     * Branch Manager / Waiter / Cashier
     */
    if (canManageOrders(req.user.role)) {
      if (
        !canAccessBranch(
          req.user.role,
          req.user.branchId,
          order.branch_id
        )
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xem order của chi nhánh khác",
        });
      }

      return res.json(order);
    }

    /**
     * User
     */
    if (order.user_id !== req.user.id) {
      return res.status(403).json({
        message: "Bạn không có quyền xem order này",
      });
    }

    return res.json(order);
  } catch (err: unknown) {
    console.error("GET ORDER DETAIL ERROR:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Không thể lấy chi tiết order";

    return res.status(500).json({
      message,
    });
  }
};

/**
 * GET /api/orders/orders/:id
 *
 * Giữ lại endpoint cũ để tránh phá frontend hiện tại.
 */
export const getOrderDetail = async (
  req: Request,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
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
              attributes: ["id", "name", "price", "image"],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    return res.json(order);
  } catch (err: unknown) {
    console.error("GET ORDER DETAIL ERROR:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Không thể lấy order";

    return res.status(500).json({
      message,
    });
  }
};

/**
 * POST /api/orders
 *
 * Order có reservation:
 *   lấy branch_id từ reservation.
 *
 * Nhân viên:
 *   lấy branch_id từ JWT.
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

    const {
      reservation_id,
      total_price,
    } = req.body;

    if (
      total_price === undefined ||
      total_price === null ||
      Number(total_price) < 0
    ) {
      return res.status(400).json({
        message: "total_price không hợp lệ",
      });
    }

    let finalBranchId: number | null = null;

    /**
     * Nếu order thuộc reservation,
     * branch lấy trực tiếp từ reservation.
     */
    if (reservation_id) {
      const reservation =
        await Reservation.findByPk(reservation_id);

      if (!reservation) {
        return res.status(404).json({
          message: "Reservation không tồn tại",
        });
      }

      finalBranchId = reservation.branch_id ?? null;
    }

    /**
     * Nếu là nhân viên chi nhánh
     * và chưa có branch từ reservation,
     * lấy branch từ JWT.
     */
   const currentBranchId = req.user.branchId;

    if (!finalBranchId && currentBranchId) {
      finalBranchId = currentBranchId;
    }

    /**
     * Nhân viên chi nhánh bắt buộc phải có branch.
     */
    if (
      canManageOrders(req.user.role) &&
      !isGlobalRole(req.user.role) &&
      !finalBranchId
    ) {
      return res.status(403).json({
        message: "Tài khoản chưa được gán chi nhánh",
      });
    }

    /**
     * Kiểm tra reservation thuộc đúng branch
     * của Branch Manager.
     */
    if (
      reservation_id &&
      req.user.role === "branch_manager"
    ) {
      const reservation =
        await Reservation.findByPk(reservation_id);

      if (
        !reservation ||
        reservation.branch_id !== req.user.branchId
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền tạo order cho chi nhánh khác",
        });
      }
    }

    const order = await Order.create({
      branch_id: finalBranchId,
      user_id: req.user.id,
      reservation_id: reservation_id || null,
      total_price: Number(total_price),
      status: "pending",
      is_deleted: false,
    });

    return res.status(201).json(order);
  } catch (err: unknown) {
    console.error("CREATE ORDER ERROR:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Không thể tạo order";

    return res.status(500).json({
      message,
    });
  }
};

/**
 * PUT /api/orders/:id/status
 */
/**
 * PUT /api/orders/:id/status
 *
 * Quy tắc:
 *
 * pending
 *   ↓
 * processing
 *   ↓
 * completed
 *
 * Không được completed nếu còn món:
 * - pending
 * - cooking
 * - ready
 *
 * Món chỉ được xem là hoàn tất khi:
 * - served
 * - cancelled
 */
export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    /*
     * =====================================================
     * 1. KIỂM TRA ĐĂNG NHẬP
     * =====================================================
     */

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    /*
     * =====================================================
     * 2. KIỂM TRA ID
     * =====================================================
     */

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    /*
     * =====================================================
     * 3. KIỂM TRA QUYỀN
     * =====================================================
     */

    if (!canManageOrders(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật order",
      });
    }

    /*
     * =====================================================
     * 4. KIỂM TRA STATUS
     * =====================================================
     */

    const { status } = req.body;

    const allowedStatuses = [
      "pending",
      "processing",
      "completed",
      "cancelled",
    ] as const;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Trạng thái order không hợp lệ",
      });
    }

    /*
     * =====================================================
     * 5. TÌM ORDER
     * =====================================================
     */

    const order = await Order.findByPk(id);

    if (!order || order.is_deleted) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /*
     * =====================================================
     * 6. KIỂM TRA CHI NHÁNH
     * =====================================================
     */

    if (
      !canAccessBranch(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền cập nhật order của chi nhánh khác",
      });
    }

    /*
     * =====================================================
     * 7. KHÔNG CHO HOÀN THÀNH ORDER KHI MÓN CHƯA XONG
     * =====================================================
     *
     * Đây là phần quan trọng nhất.
     *
     * Phải kiểm tra TRƯỚC khi order.update().
     */

    if (status === "completed") {
      const items = await OrderItem.findAll({
        where: {
          order_id: order.id,
        },
      });

      /*
      * Order phải có ít nhất 1 món
      */
      if (items.length === 0) {
        return res.status(400).json({
          message:
            "Không thể hoàn thành đơn hàng khi đơn chưa có món",
        });
      }

      /*
      * Nếu tất cả món đều bị hủy
      * thì Order phải là cancelled,
      * không được chuyển completed.
      */
      const allCancelled = items.every(
        (item) => item.status === "cancelled"
      );

      if (allCancelled) {
        return res.status(400).json({
          message:
            "Không thể hoàn thành đơn hàng vì tất cả món đều đã bị hủy",
        });
      }

      /*
      * Tìm món chưa hoàn thành.
      *
      * Chỉ:
      * - served
      * - cancelled
      *
      * mới được coi là hoàn tất.
      */
      const unfinishedItems = items.filter(
        (item) =>
          item.status !== "served" &&
          item.status !== "cancelled"
      );

      if (unfinishedItems.length > 0) {
        return res.status(400).json({
          message:
            "Không thể hoàn thành đơn khi vẫn còn món chưa phục vụ",
        });
      }
    }

    /*
     * =====================================================
     * 8. CẬP NHẬT ORDER
     * =====================================================
     */

    await order.update({
      status,
    });

    /*
     * =====================================================
     * 9. ĐỒNG BỘ RESERVATION
     * =====================================================
     */

    if (order.reservation_id) {
      const reservation =
        await Reservation.findByPk(
          order.reservation_id
        );

      if (reservation) {
        let reservationStatus =
          reservation.status;

        /*
         * Order bắt đầu xử lý
         */
        if (status === "processing") {
          reservationStatus = "confirmed";
        }

        /*
         * Order hoàn thành
         */
        if (status === "completed") {
          reservationStatus = "completed";
        }

        /*
         * Order bị hủy
         */
        if (status === "cancelled") {
          reservationStatus = "cancelled";
        }

        await reservation.update({
          status: reservationStatus,
        });
      }
    }

    /*
     * =====================================================
     * 10. TRẢ BÀN VỀ AVAILABLE
     * =====================================================
     *
     * Chỉ xử lý khi Order hoàn thành.
     */

    if (
      status === "completed" &&
      order.reservation_id
    ) {
      const reservation =
        await Reservation.findByPk(
          order.reservation_id
        );

      if (reservation && reservation.table_id) {
        const table =
          await TableModel.findByPk(
            reservation.table_id
          );

        if (table) {
          await table.update({
            status: "available",
          });
        }
      }
    }

    /*
     * =====================================================
     * 11. RESPONSE
     * =====================================================
     */

    return res.json({
      message: "Cập nhật order thành công",
      order,
    });
  } catch (err: unknown) {
    console.error(
      "UPDATE ORDER STATUS ERROR:",
      err
    );

    const message =
      err instanceof Error
        ? err.message
        : "Không thể cập nhật order";

    return res.status(500).json({
      message,
    });
  }
};

/**
 * DELETE /api/orders/:id
 *
 * Soft delete.
 */
export const deleteOrder = async (
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

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    /**
     * Chỉ các role quản lý order
     * mới được xóa.
     */
    if (!canManageOrders(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa order",
      });
    }

    const order = await Order.findByPk(id);

    if (!order || order.is_deleted) {
      return res.status(404).json({
        message: "Order không tồn tại",
      });
    }

    /**
     * Kiểm tra branch.
     */
    if (
      !canAccessBranch(
        req.user.role,
        req.user.branchId,
        order.branch_id
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa order của chi nhánh khác",
      });
    }

    await order.update({
      is_deleted: true,
    });

    return res.json({
      message: "Xóa order thành công",
    });
  } catch (err: unknown) {
    console.error("DELETE ORDER ERROR:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Không thể xóa order";

    return res.status(500).json({
      message,
    });
  }
};

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
      order: [["createdAt", "DESC"]],
    });

    return res.json(orders);
  } catch (err: unknown) {
    console.error("GET MY ORDERS ERROR:", err);

    const message =
      err instanceof Error
        ? err.message
        : "Không thể lấy order";

    return res.status(500).json({
      message,
    });
  }
};