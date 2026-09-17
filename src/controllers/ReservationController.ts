import { Request, Response } from "express";

import Reservation from "../models/Reservation";
import TableModel from "../models/Table";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Branch from "../models/Branch";

import sgMail, {
  isEmailDeliveryConfigured,
} from "../config/sendgrid";

import { getIO } from "../socket";

/* =========================================================
   AUTH TYPES
========================================================= */

interface AuthUser {
  id: number;
  email?: string;
  role: string;
  branchId: number | null;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

/* =========================================================
   CART TYPES
========================================================= */

interface CartItem {
  id: number | string;
  price: number;
  quantity: number;
}

/* =========================================================
   BRANCH MAP
========================================================= */

const branchMap: Record<string, string> = {
  "1": "Nhà hàng Vị Nhà 86 Ngọc Khánh",
  "2": "Nhà hàng Vị Nhà 67A Phó Đức Chính",
  "3": "Nhà hàng Vị Nhà 10 Khúc Thừa Dụ",
  "4": "Nhà hàng Vị Nhà 19 Nguyễn Văn Huyên",
};

/* =========================================================
   HELPER
========================================================= */

const isManagementRole = (role: string): boolean => {
  return ["admin", "chain_manager", "branch_manager"].includes(role);
};

/**
 * Kiểm tra user quản lý có được phép thao tác
 * trên reservation thuộc branch này hay không.
 */
const canManageReservation = (
  user: AuthUser,
  reservationBranchId: number | null | undefined
): boolean => {
  // Admin và chain_manager quản lý toàn hệ thống
  if (user.role === "admin" || user.role === "chain_manager") {
    return true;
  }

  // Branch manager chỉ được branch của mình
  if (user.role === "branch_manager") {
    return (
      user.branchId !== null &&
      reservationBranchId === user.branchId
    );
  }

  return false;
};

/* =========================================================
   CREATE RESERVATION
========================================================= */

export const createReservation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const {
      table_id,
      reservation_time,
      name,
      phone,
      email,
      branch,
      note,
      cart,
      guest_count,
    } = req.body as {
      table_id?: number;
      reservation_time?: string;
      name?: string;
      phone?: string;
      email?: string;
      branch?: string;
      note?: string;
      cart?: CartItem[];
      guest_count?: number;
    };

    /* ================= VALIDATE ================= */

    if (
      !table_id ||
      !reservation_time ||
      !name ||
      !phone ||
      !email
    ) {
      return res.status(400).json({
        message: "Thiếu dữ liệu",
      });
    }

    const reservationDateTime = new Date(reservation_time);

    if (Number.isNaN(reservationDateTime.getTime())) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    /* ================= CHECK TABLE ================= */

    const table = await TableModel.findByPk(table_id);

    if (!table) {
      return res.status(404).json({
        message: "Table không tồn tại",
      });
    }

    if (!table.branch_id) {
      return res.status(400).json({
        message: "Bàn chưa được gán chi nhánh",
      });
    }

    /* ================= CHECK BRANCH ================= */

    const branchId = table.branch_id;

    const branchName =
      branchMap[String(branchId)] ||
      branchMap[String(branch ?? "")] ||
      "Không xác định";

    /* ================= CHECK DUPLICATE ================= */

    const existing = await Reservation.findOne({
      where: {
        table_id,
        reservation_time: reservationDateTime,
        status: "pending",
      },
    });

    if (existing) {
      return res.status(409).json({
        message: "Bàn đã được đặt thời gian này",
      });
    }

    /* ================= USER ================= */

    const userId = req.user?.id;

    /* ================= CREATE RESERVATION ================= */

    const reservation = await Reservation.create({
      branch_id: branchId,
      table_id,
      reservation_time: reservationDateTime,
      customer_name: name,
      phone,
      email,
      branch: String(branchId),
      note,
      guest_count: guest_count ?? 1,
      user_id: userId,
      status: "pending",
    });

    /* ================= SOCKET ================= */

    const io = getIO();

    io.emit("new-reservation", {
      name,
      phone,
      time: reservation_time,
      branchId,
    });

    /* ================= CREATE ORDER ================= */

    let order: Order | null = null;

    if (Array.isArray(cart) && cart.length > 0) {
      const total = cart.reduce(
        (sum, item) =>
          sum + Number(item.price) * Number(item.quantity),
        0
      );

      order = await Order.create({
        branch_id: branchId,
        reservation_id: reservation.id,
        user_id: userId ?? undefined,
        total_price: total,
        status: "pending",
      });

      const orderItems = cart.map((item) => ({
        order_id: order!.id,
        menu_item_id: Number(item.id),
        quantity: Number(item.quantity),
        unit_price: Number(item.price),
      }));

      await OrderItem.bulkCreate(orderItems);
    }

    /* ================= SEND EMAIL ================= */

    let notificationStatus:
      | "sent"
      | "skipped"
      | "failed" = "skipped";

    const dateTimeParts = reservation_time.split(" ");

    const reservationDate = dateTimeParts[0] || reservation_time;
    const reservationTime = dateTimeParts[1] || "";

    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "",
      subject: "Xác nhận đặt bàn",
      text: `
Xin chào ${name},

Bạn đã đặt bàn thành công!

📍 Cơ sở: ${branchName}
⏰ Thời gian: ${reservation_time}
📞 SĐT: ${phone}
📅 Ngày: ${reservationDate}
⏰ Giờ: ${reservationTime}

Khi đến nhà hàng, hãy báo tên hoặc số điện thoại cho lễ tân.

Cảm ơn bạn!
      `,
    };

    if (isEmailDeliveryConfigured()) {
      try {
        await sgMail.send(msg);

        notificationStatus = "sent";
      } catch (emailError: unknown) {
        notificationStatus = "failed";

        const message =
          emailError instanceof Error
            ? emailError.message
            : "Unknown email error";

        console.error(
          "RESERVATION EMAIL FAILED:",
          message
        );
      }
    } else {
      console.warn(
        "RESERVATION EMAIL SKIPPED: email delivery is not configured"
      );
    }

    /* ================= RESPONSE ================= */

    return res.status(201).json({
      message: "Đặt bàn thành công",
      data: {
        reservation,
        order,
        notificationStatus,
      },
    });
  } catch (err: unknown) {
    console.error(
      "CREATE RESERVATION ERROR:",
      err
    );

    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};

/* =========================================================
   USER: GET MY RESERVATIONS
========================================================= */

export const getMyReservations = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const data = await Reservation.findAll({
      where: {
        user_id: req.user.id,
      },
      order: [["reservation_time", "DESC"]],
    });

    return res.json(data);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};

/* =========================================================
   ADMIN / MANAGER: GET ALL RESERVATIONS
========================================================= */

export const getAllReservationsAdmin = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const { role, branchId } = req.user;

    /* ================= CHECK ROLE ================= */

    if (!isManagementRole(role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách đặt bàn",
      });
    }

    /* ================= BRANCH MANAGER ================= */

    if (role === "branch_manager" && !branchId) {
      return res.status(403).json({
        message: "Tài khoản chưa được gán chi nhánh",
      });
    }

    /* ================= WHERE ================= */

    const where: {
      branch_id?: number;
    } = {};

    if (role === "branch_manager") {
      where.branch_id = branchId as number;
    }

    /* ================= QUERY ================= */

    const data = await Reservation.findAll({
      where,
      include: [
        {
          model: TableModel,
          attributes: [
            "id",
            "name",
            "capacity",
          ],
        },
        {
          model: Branch,
          as: "restaurantBranch",
          attributes: [
            "id",
            "name",
            "code",
          ],
        },
      ],
      order: [["reservation_time", "DESC"]],
    });

    return res.json(data);
  } catch (err: unknown) {
    console.error(
      "GET ADMIN RESERVATION ERROR:",
      err
    );

    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};

/* =========================================================
   GET RESERVATION BY ID
========================================================= */

export const getReservationById = async (
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

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const reservation = await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation không tồn tại",
      });
    }

    const { role, branchId } = req.user;

    /* ================= MANAGEMENT ================= */

    if (isManagementRole(role)) {
      if (
        role === "branch_manager" &&
        branchId !== reservation.branch_id
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xem reservation của chi nhánh khác",
        });
      }

      return res.json(reservation);
    }

    /* ================= NORMAL USER ================= */

    if (reservation.user_id !== req.user.id) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem reservation này",
      });
    }

    return res.json(reservation);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};

/* =========================================================
   CANCEL RESERVATION
========================================================= */

export const cancelReservation = async (
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

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const reservation = await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation không tồn tại",
      });
    }

    const { role, branchId } = req.user;

    /* ================= MANAGEMENT ================= */

    if (isManagementRole(role)) {
      if (
        role === "branch_manager" &&
        branchId !== reservation.branch_id
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền hủy reservation của chi nhánh khác",
        });
      }
    } else {
      /* ================= USER ================= */

      if (reservation.user_id !== req.user.id) {
        return res.status(403).json({
          message:
            "Bạn không có quyền hủy reservation này",
        });
      }
    }

    /* ================= CANCEL ================= */

    await reservation.update({
      status: "cancelled",
    });

    /* ================= FREE TABLE ================= */

    const table = await TableModel.findByPk(
      reservation.table_id
    );

    if (table) {
      await table.update({
        status: "available",
      });
    }

    return res.json({
      message: "Đã hủy đặt bàn",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};

/* =========================================================
   UPDATE RESERVATION
========================================================= */

export const updateReservation = async (
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

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const {
      table_id,
      reservation_time,
      status,
    } = req.body as {
      table_id?: number;
      reservation_time?: string;
      status?: string;
    };

    const reservation =
      await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation không tồn tại",
      });
    }

    const { role, branchId } = req.user;

    /* ================= CHECK PERMISSION ================= */

    if (isManagementRole(role)) {
      if (
        role === "branch_manager" &&
        branchId !== reservation.branch_id
      ) {
        return res.status(403).json({
          message:
            "Bạn không có quyền sửa reservation của chi nhánh khác",
        });
      }
    } else {
      if (reservation.user_id !== req.user.id) {
        return res.status(403).json({
          message:
            "Bạn không có quyền sửa reservation này",
        });
      }
    }

    /* ================= CHECK NEW TABLE ================= */

    let newTable = null;

    if (table_id !== undefined) {
      newTable = await TableModel.findByPk(
        table_id
      );

      if (!newTable) {
        return res.status(404).json({
          message: "Bàn mới không tồn tại",
        });
      }

      if (!newTable.branch_id) {
        return res.status(400).json({
          message:
            "Bàn mới chưa được gán chi nhánh",
        });
      }

      /*
       * Branch manager không được chuyển
       * reservation sang chi nhánh khác.
       */
      if (
        role === "branch_manager" &&
        newTable.branch_id !== branchId
      ) {
        return res.status(403).json({
          message:
            "Không thể chuyển reservation sang chi nhánh khác",
        });
      }

      /*
       * Với reservation hiện tại,
       * không cho phép đổi sang branch khác.
       */
      if (
        reservation.branch_id !== null &&
        newTable.branch_id !== reservation.branch_id
      ) {
        return res.status(400).json({
          message:
            "Bàn mới phải thuộc cùng chi nhánh",
        });
      }
    }

    /* ================= UPDATE ================= */

    const newReservationTime =
      reservation_time !== undefined
        ? new Date(reservation_time)
        : reservation.reservation_time;

    if (Number.isNaN(newReservationTime.getTime())) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    await reservation.update({
      table_id:
        table_id ?? reservation.table_id,

      reservation_time: newReservationTime,

      status:
        status ?? reservation.status,
    });

    return res.json({
      message: "Cập nhật thành công",
      data: reservation,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};

/* =========================================================
   DELETE RESERVATION
========================================================= */

export const deleteReservation = async (
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

    if (!id || Number.isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    /* ================= FIND RESERVATION ================= */

    const reservation =
      await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation không tồn tại",
      });
    }

    const { role, branchId } = req.user;

    /* ================= ROLE ================= */

    if (!isManagementRole(role)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa reservation",
      });
    }

    /* ================= BRANCH ISOLATION ================= */

    if (
      role === "branch_manager" &&
      branchId !== reservation.branch_id
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa reservation của chi nhánh khác",
      });
    }

    /* ================= DELETE ================= */

    await reservation.destroy();

    return res.json({
      message: "Xóa thành công",
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown server error";

    return res.status(500).json({
      message: "Lỗi server",
      error: message,
    });
  }
};