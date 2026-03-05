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

    const table = await TableModel.findByPk(table_id);

    if (!table) {
      return res.status(404).json({ message: "Table không tồn tại" });
    }

    // kiểm tra trùng reservation
    const existingReservation = await Reservation.findOne({
      where: {
        table_id,
        reservation_time,
        status: "pending"
      }
    });

    if (existingReservation) {
      return res.status(409).json({
        message: "Bàn đã được đặt vào thời gian này"
      });
    }

    const reservation = await Reservation.create({
      user_id: req.user.id,
      table_id,
      reservation_time,
      status: "pending",
    });

    res.status(201).json({
      message: "Đặt bàn thành công",
      data: reservation
    });

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

export const getAllReservationsAdmin = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user || req.user.role_id !== 1) {
      return res.status(403).json({ message: "Admin only" });
    }

    const data = await Reservation.findAll({
      order: [["reservation_time", "DESC"]],
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const getReservationById = async (req: AuthRequest,res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);

    const reservation = await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({ message: "Reservation không tồn tại" });
    }

    if (req.user.role_id !== 1 && reservation.user_id !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(reservation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const cancelReservation = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const id = Number(req.params.id);

    const reservation = await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({ message: "Reservation không tồn tại" });
    }

    if (reservation.user_id !== req.user.id && req.user.role_id !== 1) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const table = await TableModel.findByPk(reservation.table_id);

    await reservation.update({ status: "cancelled" });

    if (table) {
      await table.update({ status: "available" });
    }

    res.json({ message: "Đã hủy đặt bàn" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};