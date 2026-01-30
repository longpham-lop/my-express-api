import { Request, Response } from "express";
import Reservation from "../models/Reservation";
import TableModel from "../models/Table";

/**
 * User lấy từ JWT → chỉ cần các field cần dùng
 */
interface AuthUser {
  id: number;
  email?: string;
  role_id?: number;
}

/**
 * Mở rộng Request của Express
 */
interface AuthRequest extends Request {
  user?: AuthUser;
}

/* ================= CREATE RESERVATION ================= */
export const createReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { table_id, reservation_time } = req.body;

    if (!table_id || !reservation_time) {
      return res.status(400).json({ message: "Thiếu dữ liệu" });
    }

    // kiểm tra bàn
    const table = await TableModel.findByPk(table_id);
    if (!table) {
      return res.status(400).json({ message: "Table không tồn tại" });
    }

    if (table.status !== "available") {
      return res.status(400).json({ message: "Bàn đã được đặt" });
    }

    // tạo reservation
    const reservation = await Reservation.create({
      user_id: req.user.id, // ✅ từ JWT
      table_id,
      reservation_time,
      status: "pending",
    });

    // cập nhật trạng thái bàn
    await table.update({ status: "reserved" });

    res.status(201).json(reservation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ================= GET ALL RESERVATIONS (THEO USER) ================= */
export const getAllReservations = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const data = await Reservation.findAll({
      where: { user_id: req.user.id },
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllReservationsAdmin = async (req: Request, res: Response) => {
  const data = await Reservation.findAll();
  res.json(data);
};


