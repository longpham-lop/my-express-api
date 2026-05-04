import { Request, Response } from "express";
import Reservation from "../models/Reservation";
import TableModel from "../models/Table";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import { io } from "../indexs";
/* ===== TYPE USER ===== */
interface AuthUser {
  id: number;
  email?: string;
  role: string;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

/* ================= CREATE ================= */
export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    const { table_id, reservation_time, name, phone, branch, note, cart } = req.body;

    if (!table_id || !reservation_time || !name || !phone) {
      return res.status(400).json({ message: "Thiếu dữ liệu" });
    }

    const table = await TableModel.findByPk(table_id);
    if (!table) {
      return res.status(404).json({ message: "Table không tồn tại" });
    }

    const existing = await Reservation.findOne({
      where: {
        table_id,
        reservation_time,
        status: "pending",
      },
    });

    if (existing) {
      return res.status(409).json({
        message: "Bàn đã được đặt thời gian này",
      });
    }

    const userId = req.user?.id;

    const reservation = await Reservation.create({
      table_id,
      reservation_time,
      customer_name: name,
      phone,
      branch,
      note,
      user_id: userId,
      status: "pending",
    });
    io.emit("new-reservation", {
      name,
      phone,
      time: reservation_time,
    });

    let order: Order | null = null;

    if (Array.isArray(cart) && cart.length > 0) {
      const total = cart.reduce(
        (sum: number, item: { price: number; quantity: number }) =>
          sum + item.price * item.quantity,
        0
      );

      order = await Order.create({
        reservation_id: reservation.id,
        user_id: userId ?? undefined,
        total_price: total,
        status: "pending",
      });

      const orderItems = cart.map((item: any) => ({
        order_id: order!.id,
        menu_item_id: Number(item.id),
        quantity: item.quantity,
        unit_price: item.price,
      }));

      await OrderItem.bulkCreate(orderItems);
    }

    return res.status(201).json({
      message: "Đặt bàn thành công",
      data: { reservation, order },
    });

  } catch (err: any) {
    console.error("CREATE RESERVATION ERROR:", err);
    return res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};

/* ================= USER: GET MY ================= */
export const getMyReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const data = await Reservation.findAll({
      where: { user_id: req.user.id },
      order: [["reservation_time", "DESC"]],
    });

    res.json(data);

  } catch (err: any) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

/* ================= ADMIN: GET ALL ================= */
export const getAllReservationsAdmin = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const data = await Reservation.findAll({
      include: [
        {
          model: TableModel,
          attributes: ["id", "name", "capacity"],
        },
      ],
      order: [["reservation_time", "DESC"]],
    });

    res.json(data);

  } catch (err: any) {
    console.error("GET ADMIN RESERVATION ERROR:", err);
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

/* ================= GET BY ID ================= */
export const getReservationById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
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

    // user chỉ xem của mình
    if (
      req.user &&
      req.user.role !== "admin" &&
      reservation.user_id !== req.user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(reservation);

  } catch (err: any) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

/* ================= CANCEL ================= */
export const cancelReservation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
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

    // check quyền
    if (
      req.user &&
      req.user.role !== "admin" &&
      reservation.user_id !== req.user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await reservation.update({ status: "cancelled" });

    // trả bàn
    const table = await TableModel.findByPk(reservation.table_id);
    if (table) {
      await table.update({ status: "available" });
    }

    res.json({ message: "Đã hủy đặt bàn" });

  } catch (err: any) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

/* ================= UPDATE ================= */
export const updateReservation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }
    const { table_id, reservation_time, status } = req.body;

    const reservation = await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message: "Reservation không tồn tại",
      });
    }

    // quyền
    if (
      req.user &&
      req.user.role !== "admin" &&
      reservation.user_id !== req.user.id
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await reservation.update({
      table_id: table_id ?? reservation.table_id,
      reservation_time:
        reservation_time ?? reservation.reservation_time,
      status: status ?? reservation.status,
    });

    res.json({
      message: "Cập nhật thành công",
      data: reservation,
    });

  } catch (err: any) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};

/* ================= DELETE (ADMIN) ================= */
export const deleteReservation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Admin only" });
    }

    const id = Number(req.params.id);

    if (!id || isNaN(id)) {
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

    await reservation.destroy();

    res.json({ message: "Xóa thành công" });

  } catch (err: any) {
    res.status(500).json({ message: "Lỗi server", error: err.message });
  }
};