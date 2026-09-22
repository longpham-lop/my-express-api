import { Request, Response } from "express";

import {
  Branch,
  BranchSetting,
  StaffBranch,
  Table,
  TableArea,
  User,
} from "../models";

import type { AuthRequest } from "../middlewares/auth.middleware";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

/**
 * =========================================================
 * PUBLIC - DANH SÁCH CHI NHÁNH
 * =========================================================
 *
 * Không yêu cầu đăng nhập.
 *
 * Chỉ lấy các chi nhánh đang hoạt động.
 */
export const listPublicBranches = async (
  _req: Request,
  res: Response
) => {
  try {
    const branches = await Branch.findAll({
      where: {
        status: "active",
      },

      attributes: [
        "id",
        "code",
        "name",
        "address",
        "phone",
        "opening_time",
        "closing_time",
        "is_accepting_reservations",
      ],

      order: [["name", "ASC"]],
    });

    return res.json({
      data: branches,
    });
  } catch (error) {
    console.error("listPublicBranches error:", error);

    return res.status(500).json({
      message: "Không thể tải danh sách chi nhánh",
    });
  }
};

/**
 * =========================================================
 * ADMIN - DANH SÁCH CHI NHÁNH
 * =========================================================
 *
 * Admin:
 *      Xem tất cả chi nhánh.
 *
 * Chain Manager:
 *      Xem tất cả chi nhánh.
 *
 * Branch Manager:
 *      Chỉ xem chi nhánh mà mình đang quản lý.
 */
export const listBranches = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const role = req.user?.role;
    const branchId = req.user?.branchId;

    /**
     * Điều kiện tìm kiếm.
     *
     * Admin và Chain Manager:
     *      không giới hạn branch_id.
     *
     * Branch Manager:
     *      chỉ lấy branch_id của chính mình.
     */
    const where =
      role === "branch_manager"
        ? {
            id: branchId ?? -1,
          }
        : undefined;

    const branches = await Branch.findAll({
      where,

      include: [
        {
          model: BranchSetting,
          as: "settings",
        },
      ],

      order: [["name", "ASC"]],
    });

    return res.json({
      data: branches,
    });
  } catch (error) {
    console.error("listBranches error:", error);

    return res.status(500).json({
      message: "Không thể tải danh sách chi nhánh",
    });
  }
};

/**
 * =========================================================
 * CREATE BRANCH
 * =========================================================
 *
 * Chỉ Admin / Chain Manager được gọi route này.
 */
export const createBranch = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      code,
      name,
      address,
      phone,
      opening_time = "09:00",
      closing_time = "22:00",
    } = req.body;

    /**
     * Validate dữ liệu bắt buộc.
     */
    if (
      !code ||
      !name ||
      !address ||
      !timePattern.test(String(opening_time)) ||
      !timePattern.test(String(closing_time))
    ) {
      return res.status(400).json({
        message:
          "code, name, address và giờ mở/đóng hợp lệ là bắt buộc",
      });
    }

    /**
     * Chuẩn hóa mã chi nhánh.
     *
     * Ví dụ:
     * hn01 → HN01
     */
    const normalizedCode = String(code)
      .trim()
      .toUpperCase();

    /**
     * Kiểm tra code đã tồn tại chưa.
     */
    const existingBranch = await Branch.findOne({
      where: {
        code: normalizedCode,
      },
    });

    if (existingBranch) {
      return res.status(409).json({
        message: "Mã chi nhánh đã tồn tại",
      });
    }

    /**
     * Tạo chi nhánh.
     */
    const branch = await Branch.create({
      code: normalizedCode,
      name: String(name).trim(),
      address: String(address).trim(),
      phone: phone ? String(phone).trim() : undefined,
      opening_time,
      closing_time,
    });

    /**
     * Tạo settings mặc định cho chi nhánh.
     */
    const settings = await BranchSetting.create({
      branch_id: branch.id!,
    });

    return res.status(201).json({
      data: {
        ...branch.toJSON(),
        settings,
      },
    });
  } catch (error) {
    console.error("createBranch error:", error);

    return res.status(500).json({
      message: "Không thể tạo chi nhánh",
    });
  }
};

/**
 * =========================================================
 * UPDATE BRANCH
 * =========================================================
 *
 * Chỉ Admin / Chain Manager được gọi.
 */
export const updateBranch = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(req.params.id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "ID chi nhánh không hợp lệ",
      });
    }

    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    /**
     * Những field được phép cập nhật.
     */
    const allowedFields = [
      "name",
      "address",
      "phone",
      "opening_time",
      "closing_time",
      "is_accepting_reservations",
      "status",
    ] as const;

    const values: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        values[field] = req.body[field];
      }
    }

    /**
     * Validate giờ mở cửa.
     */
    if (
      values.opening_time !== undefined &&
      !timePattern.test(String(values.opening_time))
    ) {
      return res.status(400).json({
        message: "Giờ mở cửa phải theo định dạng HH:mm",
      });
    }

    /**
     * Validate giờ đóng cửa.
     */
    if (
      values.closing_time !== undefined &&
      !timePattern.test(String(values.closing_time))
    ) {
      return res.status(400).json({
        message: "Giờ đóng cửa phải theo định dạng HH:mm",
      });
    }

    /**
     * Không có dữ liệu để cập nhật.
     */
    if (Object.keys(values).length === 0) {
      return res.status(400).json({
        message: "Không có dữ liệu để cập nhật",
      });
    }

    await branch.update(values);

    return res.json({
      data: branch,
    });
  } catch (error) {
    console.error("updateBranch error:", error);

    return res.status(500).json({
      message: "Không thể cập nhật chi nhánh",
    });
  }
};

/**
 * =========================================================
 * UPDATE BRANCH SETTINGS
 * =========================================================
 */
export const updateBranchSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(req.params.id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "ID chi nhánh không hợp lệ",
      });
    }

    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    /**
     * Tìm settings hiện tại.
     * Nếu chưa có thì tạo mới.
     */
    const [settings] = await BranchSetting.findOrCreate({
      where: {
        branch_id: branchId,
      },
    });

    const fields = [
      "default_table_duration_minutes",
      "reservation_interval_minutes",
      "reservation_lead_time_minutes",
    ] as const;

    const values: Record<string, number> = {};

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);

        if (!Number.isInteger(value) || value <= 0) {
          return res.status(400).json({
            message: `${field} phải là số nguyên dương`,
          });
        }

        values[field] = value;
      }
    }

    if (Object.keys(values).length === 0) {
      return res.status(400).json({
        message: "Không có dữ liệu để cập nhật",
      });
    }

    await settings.update(values);

    return res.json({
      data: settings,
    });
  } catch (error) {
    console.error("updateBranchSettings error:", error);

    return res.status(500).json({
      message: "Không thể cập nhật cấu hình chi nhánh",
    });
  }
};

/**
 * =========================================================
 * LIST AREAS
 * =========================================================
 *
 * Ví dụ:
 *
 * Chi nhánh 1
 * ├── Tầng 1
 * ├── Tầng 2
 * ├── Ngoài trời
 * └── VIP
 */
export const listAreas = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(req.params.id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "ID chi nhánh không hợp lệ",
      });
    }

    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    const data = await TableArea.findAll({
      where: {
        branch_id: branchId,
      },

      order: [
        ["sort_order", "ASC"],
        ["name", "ASC"],
      ],
    });

    return res.json({
      data,
    });
  } catch (error) {
    console.error("listAreas error:", error);

    return res.status(500).json({
      message: "Không thể tải danh sách khu vực",
    });
  }
};

/**
 * =========================================================
 * CREATE AREA
 * =========================================================
 */
export const createArea = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(req.params.id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "ID chi nhánh không hợp lệ",
      });
    }

    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    const name =
      typeof req.body.name === "string"
        ? req.body.name.trim()
        : "";

    if (!name) {
      return res.status(400).json({
        message: "Tên khu vực là bắt buộc",
      });
    }

    const sortOrder =
      req.body.sort_order !== undefined
        ? Number(req.body.sort_order)
        : 0;

    if (!Number.isInteger(sortOrder)) {
      return res.status(400).json({
        message: "sort_order phải là số nguyên",
      });
    }

    const data = await TableArea.create({
      branch_id: branchId,
      name,
      sort_order: sortOrder,
    });

    return res.status(201).json({
      data,
    });
  } catch (error) {
    console.error("createArea error:", error);

    return res.status(500).json({
      message: "Không thể tạo khu vực",
    });
  }
};

/**
 * =========================================================
 * ASSIGN STAFF TO BRANCH
 * =========================================================
 */
export const assignStaff = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(req.params.id);
    const userId = Number(req.body.user_id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "ID chi nhánh không hợp lệ",
      });
    }

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        message: "user_id không hợp lệ",
      });
    }

    const [branch, user] = await Promise.all([
      Branch.findByPk(branchId),
      User.findByPk(userId),
    ]);

    if (!branch || !user) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh hoặc nhân viên",
      });
    }

    const isPrimary = Boolean(req.body.is_primary);

    const [assignment, created] =
      await StaffBranch.findOrCreate({
        where: {
          branch_id: branchId,
          user_id: userId,
        },

        defaults: {
          branch_id: branchId,
          user_id: userId,
          is_primary: isPrimary,
          is_active: true,
        },
      });

    /**
     * Nếu assignment đã tồn tại
     * thì cập nhật lại thông tin.
     */
    if (!created) {
      await assignment.update({
        is_primary: isPrimary,
        is_active:
          req.body.is_active !== undefined
            ? Boolean(req.body.is_active)
            : true,
      });
    }

    return res.status(created ? 201 : 200).json({
      data: assignment,
    });
  } catch (error) {
    console.error("assignStaff error:", error);

    return res.status(500).json({
      message: "Không thể phân công nhân viên",
    });
  }
};
export const updateArea = async (req: Request, res: Response) => {
  try {
    const branchId = Number(req.params.id);
    const areaId = Number(req.params.areaId);

    const { name, sort_order, is_active } = req.body;

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "branch_id không hợp lệ",
      });
    }

    if (!Number.isInteger(areaId)) {
      return res.status(400).json({
        message: "area_id không hợp lệ",
      });
    }

    const area = await TableArea.findOne({
      where: {
        id: areaId,
        branch_id: branchId,
      },
    });

    if (!area) {
      return res.status(404).json({
        message: "Không tìm thấy khu vực",
      });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({
          message: "Tên khu vực không được để trống",
        });
      }

      area.name = String(name).trim();
    }

    if (sort_order !== undefined) {
      const order = Number(sort_order);

      if (!Number.isInteger(order) || order < 0) {
        return res.status(400).json({
          message: "Thứ tự khu vực không hợp lệ",
        });
      }

      area.sort_order = order;
    }

    if (is_active !== undefined) {
      const active = Boolean(is_active);

      if (typeof req.body.is_active !== "boolean") {
        return res.status(400).json({
          message: "is_active phải là boolean",
        });
      }

      area.is_active = active;
    }

    await area.save();

    return res.status(200).json({
      message: "Cập nhật khu vực thành công",
      data: area,
    });
  } catch (err) {
    console.error("UPDATE AREA ERROR:", err);

    return res.status(500).json({
      message: "Không thể cập nhật khu vực",
    });
  }
};
export const deleteArea = async (req: Request, res: Response) => {
  try {
    const branchId = Number(req.params.id);
    const areaId = Number(req.params.areaId);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "branch_id không hợp lệ",
      });
    }

    if (!Number.isInteger(areaId)) {
      return res.status(400).json({
        message: "area_id không hợp lệ",
      });
    }

    const area = await TableArea.findOne({
      where: {
        id: areaId,
        branch_id: branchId,
      },
    });

    if (!area) {
      return res.status(404).json({
        message: "Không tìm thấy khu vực",
      });
    }

    const tableCount = await Table.count({
      where: {
        area_id: areaId,
      },
    });

    if (tableCount > 0) {
      return res.status(400).json({
        message:
          "Không thể xóa khu vực vì vẫn còn bàn thuộc khu vực này",
      });
    }

    await area.destroy();

    return res.status(200).json({
      message: "Xóa khu vực thành công",
    });
  } catch (err) {
    console.error("DELETE AREA ERROR:", err);

    return res.status(500).json({
      message: "Không thể xóa khu vực",
    });
  }
};