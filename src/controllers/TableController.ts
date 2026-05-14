import { Request, Response } from "express";
import Table from "../models/Table";
import Reservation from "../models/Reservation";

export const createTable = async (req: Request, res: Response) => {
  try {
    const { name, capacity,type } = req.body;

    const table = await Table.create({
      name,
      capacity,
      type: type?.trim().toLowerCase() === "vip" ? "vip" : "normal",
      status: "available",
    });

    res.status(201).json(table);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
// GET ALL TABLES
export const getAllTable = async (req: Request, res: Response) => {
  try {
    const tables = await Table.findAll({
      order: [["id", "ASC"]],
    });

    res.json(tables);

  } catch (err: any) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};


// UPDATE TABLE STATUS
export const updateStatus = async (req: Request, res: Response) => {
  try {

    const id = Number(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({
        message: "Invalid table id",
      });
    }

    const validStatus = ["available", "reserved", "occupied"];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        message: "Invalid table status",
      });
    }

    const [updatedCount, updatedRows] = await Table.update(
      { status },
      {
        where: { id },
        returning: true,
      }
    );

    if (updatedCount === 0) {
      return res.status(404).json({
        message: "Table not found",
      });
    }

    res.json({
      message: "Update table status success",
      data: updatedRows[0],
    });

  } catch (err: any) {
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};
/* ===== GET BY ID ===== */
export const getTableById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    res.json(table);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ===== UPDATE FULL ===== */
export const updateTable = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    const table = await Table.findByPk(id);
    if (!table) {
      return res.status(404).json({ message: "Table not found" });
    }

    await table.update(req.body);

    res.json({
      message: "Update table success",
      data: table,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

/* ===== DELETE ===== */
export const deleteTable = async (req: Request, res: Response) => {
   try {
    const id = Number(req.params.id);

    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        message: "Không tìm thấy bàn",
      });
    }

    // Xóa reservation liên quan
    await Reservation.destroy({
      where: {
        table_id: id,
      },
    });

    // Xóa bàn
    await table.destroy();

    return res.json({
      message: "Xóa bàn thành công",
    });

  } catch (err) {
    console.error("DELETE TABLE ERROR:", err);

    return res.status(500).json({
      message: "Lỗi server khi xóa bàn",
    });
  }
};