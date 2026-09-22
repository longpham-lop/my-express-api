import { Request, Response } from "express";
import Table from "../models/Table";
import Reservation from "../models/Reservation";
import TableArea from "../models/TableArea";
import Branch from "../models/Branch";

export const createTable = async (req: Request, res: Response) => {
  try {
    const {
      name,
      capacity,
      type,
      branch_id,
      area_id,
    } = req.body;

    if (
      !name ||
      !Number.isInteger(Number(capacity)) ||
      Number(capacity) <= 0
    ) {
      return res.status(400).json({
        message: "name và capacity hợp lệ là bắt buộc",
      });
    }

    const branchId = Number(branch_id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "Chi nhánh không hợp lệ",
      });
    }

    // Kiểm tra chi nhánh tồn tại
    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    const areaId =
      area_id !== undefined &&
      area_id !== null &&
      area_id !== ""
        ? Number(area_id)
        : null;

    // Nếu có khu vực thì kiểm tra khu vực thuộc đúng chi nhánh
    if (areaId !== null) {
      if (!Number.isInteger(areaId)) {
        return res.status(400).json({
          message: "Khu vực không hợp lệ",
        });
      }

      const area = await TableArea.findOne({
        where: {
          id: areaId,
          branch_id: branchId,
        },
      });

      if (!area) {
        return res.status(400).json({
          message: "Khu vực không thuộc chi nhánh đã chọn",
        });
      }
    }

    const table = await Table.create({
      name: name.trim(),
      capacity: Number(capacity),
      type:
        type?.trim().toLowerCase() === "vip"
          ? "vip"
          : "normal",
      status: "available",
      branch_id: branchId,
      area_id: areaId,
    });

    return res.status(201).json(table);
  } catch (err: any) {
    console.error("CREATE TABLE ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};
// GET ALL TABLES
export const getAllTable = async (req: Request, res: Response) => {
  try {
    const branchId = req.query.branch_id ? Number(req.query.branch_id) : undefined;
    if (req.query.branch_id && (!branchId || !Number.isInteger(branchId))) return res.status(400).json({ message: "branch_id không hợp lệ" });
    const tables = await Table.findAll({
      where: branchId ? { branch_id: branchId } : undefined,
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
