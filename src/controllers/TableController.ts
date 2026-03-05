import { Request, Response } from "express";
import Table from "../models/Table";

export const createTable = async (req: Request, res: Response) => {
  try {
    const { name, capacity } = req.body;

    const table = await Table.create({
      name,
      capacity,
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