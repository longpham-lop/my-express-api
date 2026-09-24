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
 * HELPER - KIỂM TRA QUYỀN CHI NHÁNH
 * =========================================================
 */

/**
 * Admin và Chain Manager:
 * Có quyền trên tất cả chi nhánh.
 */
const isGlobalRole = (role?: string) => {
  return role === "admin" || role === "chain_manager";
};

/**
 * Branch Manager:
 * Chỉ được thao tác trên chi nhánh được gán.
 */
const isBranchManager = (role?: string) => {
  return role === "branch_manager";
};

/**
 * Kiểm tra Branch Manager có được phép thao tác
 * trên branchId hay không.
 *
 * Return:
 * true  -> được phép
 * false -> không được phép
 */
const canAccessBranch = (
  req: AuthRequest,
  branchId: number
): boolean => {
  if (!req.user) {
    return false;
  }

  /**
   * Admin / Chain Manager:
   * được phép tất cả.
   */
  if (isGlobalRole(req.user.role)) {
    return true;
  }

  /**
   * Branch Manager:
   * chỉ được phép branch của chính mình.
   */
  if (isBranchManager(req.user.role)) {
    return (
      req.user.branchId !== null &&
      req.user.branchId === branchId
    );
  }

  return false;
};

/**
 * =========================================================
 * PUBLIC - DANH SÁCH CHI NHÁNH
 * =========================================================
 *
 * Không yêu cầu đăng nhập.
 *
 * Dùng cho:
 * - Website khách hàng
 * - Trang đặt bàn
 * - Trang địa điểm
 *
 * KHÔNG dùng API này cho Admin.
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

    return res.status(200).json({
      data: branches,
    });
  } catch (error) {
    console.error(
      "LIST PUBLIC BRANCHES ERROR:",
      error
    );

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
 *      Xem tất cả.
 *
 * Chain Manager:
 *      Xem tất cả.
 *
 * Branch Manager:
 *      Chỉ xem branch của mình.
 */
export const listBranches = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const role = req.user.role;
    const branchId = req.user.branchId;

    /**
     * Branch Manager phải được gán branch.
     */
    if (
      isBranchManager(role) &&
      !branchId
    ) {
      return res.status(403).json({
        message:
          "Tài khoản Branch Manager chưa được gán chi nhánh",
      });
    }

    /**
     * Admin / Chain Manager:
     * lấy tất cả branch.
     *
     * Branch Manager:
     * chỉ lấy branch của mình.
     */
    const where = isBranchManager(role)
      ? {
          id: branchId!,
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

    return res.status(200).json({
      data: branches,
    });
  } catch (error) {
    console.error(
      "LIST BRANCHES ERROR:",
      error
    );

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
 * Chỉ Admin / Chain Manager được phép.
 *
 * Route cũng phải được bảo vệ bằng:
 *
 * requireRole("admin", "chain_manager")
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
     * Chuẩn hóa code.
     *
     * hn01 -> HN01
     */
    const normalizedCode = String(code)
      .trim()
      .toUpperCase();

    /**
     * Kiểm tra code trùng.
     */
    const existingBranch =
      await Branch.findOne({
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
     * Tạo branch.
     */
    const branch = await Branch.create({
      code: normalizedCode,
      name: String(name).trim(),
      address: String(address).trim(),
      phone: phone
        ? String(phone).trim()
        : undefined,
      opening_time,
      closing_time,
    });

    /**
     * Tạo settings mặc định.
     */
    const settings =
      await BranchSetting.create({
        branch_id: branch.id!,
      });

    return res.status(201).json({
      data: {
        ...branch.toJSON(),
        settings,
      },
    });
  } catch (error) {
    console.error(
      "CREATE BRANCH ERROR:",
      error
    );

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
 * Chỉ Admin / Chain Manager.
 *
 * Branch Manager KHÔNG được gọi chức năng này.
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

    const branch =
      await Branch.findByPk(branchId);

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

    const values: Record<
      string,
      unknown
    > = {};

    for (const field of allowedFields) {
      if (
        req.body[field] !== undefined
      ) {
        values[field] =
          req.body[field];
      }
    }

    /**
     * Validate giờ mở cửa.
     */
    if (
      values.opening_time !== undefined &&
      !timePattern.test(
        String(values.opening_time)
      )
    ) {
      return res.status(400).json({
        message:
          "Giờ mở cửa phải theo định dạng HH:mm",
      });
    }

    /**
     * Validate giờ đóng cửa.
     */
    if (
      values.closing_time !== undefined &&
      !timePattern.test(
        String(values.closing_time)
      )
    ) {
      return res.status(400).json({
        message:
          "Giờ đóng cửa phải theo định dạng HH:mm",
      });
    }

    /**
     * Không có dữ liệu.
     */
    if (
      Object.keys(values).length === 0
    ) {
      return res.status(400).json({
        message:
          "Không có dữ liệu để cập nhật",
      });
    }

    await branch.update(values);

    return res.status(200).json({
      data: branch,
    });
  } catch (error) {
    console.error(
      "UPDATE BRANCH ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể cập nhật chi nhánh",
    });
  }
};

/**
 * =========================================================
 * UPDATE BRANCH SETTINGS
 * =========================================================
 *
 * Chỉ Admin / Chain Manager.
 */
export const updateBranchSettings = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(req.params.id);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message:
          "ID chi nhánh không hợp lệ",
      });
    }

    const branch =
      await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message:
          "Không tìm thấy chi nhánh",
      });
    }

    /**
     * Tìm hoặc tạo settings.
     */
    const [settings] =
      await BranchSetting.findOrCreate({
        where: {
          branch_id: branchId,
        },
      });

    const fields = [
      "default_table_duration_minutes",
      "reservation_interval_minutes",
      "reservation_lead_time_minutes",
    ] as const;

    const values: Record<
      string,
      number
    > = {};

    for (const field of fields) {
      if (
        req.body[field] !== undefined
      ) {
        const value = Number(
          req.body[field]
        );

        if (
          !Number.isInteger(value) ||
          value <= 0
        ) {
          return res.status(400).json({
            message:
              `${field} phải là số nguyên dương`,
          });
        }

        values[field] = value;
      }
    }

    if (
      Object.keys(values).length === 0
    ) {
      return res.status(400).json({
        message:
          "Không có dữ liệu để cập nhật",
      });
    }

    await settings.update(values);

    return res.status(200).json({
      data: settings,
    });
  } catch (error) {
    console.error(
      "UPDATE BRANCH SETTINGS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể cập nhật cấu hình chi nhánh",
    });
  }
};

/**
 * =========================================================
 * LIST AREAS
 * =========================================================
 *
 * Admin:
 *      được xem tất cả.
 *
 * Chain Manager:
 *      được xem tất cả.
 *
 * Branch Manager:
 *      chỉ được xem area của branch mình.
 */
export const listAreas = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const branchId = Number(
      req.params.id
    );

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message:
          "branch_id không hợp lệ",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    /**
     * Kiểm tra quyền branch.
     */
    if (
      !canAccessBranch(
        req,
        branchId
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền truy cập chi nhánh này",
      });
    }

    /**
     * Kiểm tra branch tồn tại.
     */
    const branch =
      await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message:
          "Không tìm thấy chi nhánh",
      });
    }

    /**
     * Lấy danh sách khu vực.
     */
    const areas =
      await TableArea.findAll({
        where: {
          branch_id: branchId,
        },

        order: [
          ["sort_order", "ASC"],
          ["name", "ASC"],
        ],
      });

    return res.status(200).json({
      data: areas,
    });
  } catch (error) {
    console.error(
      "LIST AREAS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể tải danh sách khu vực",
    });
  }
};

/**
 * =========================================================
 * CREATE AREA
 * =========================================================
 *
 * Admin:
 *      được tạo ở tất cả branch.
 *
 * Chain Manager:
 *      được tạo ở tất cả branch.
 *
 * Branch Manager:
 *      chỉ được tạo ở branch của mình.
 */
export const createArea = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const branchId = Number(
      req.params.id
    );

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message:
          "branch_id không hợp lệ",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    /**
     * Branch isolation.
     */
    if (
      !canAccessBranch(
        req,
        branchId
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền tạo khu vực cho chi nhánh này",
      });
    }

    /**
     * Kiểm tra branch.
     */
    const branch =
      await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message:
          "Không tìm thấy chi nhánh",
      });
    }

    const {
      name,
      sort_order,
    } = req.body;

    /**
     * Validate tên.
     */
    if (!String(name || "").trim()) {
      return res.status(400).json({
        message:
          "Tên khu vực không được để trống",
      });
    }

    /**
     * Validate sort_order.
     */
    let normalizedSortOrder = 0;

    if (
      sort_order !== undefined
    ) {
      normalizedSortOrder =
        Number(sort_order);

      if (
        !Number.isInteger(
          normalizedSortOrder
        ) ||
        normalizedSortOrder < 0
      ) {
        return res.status(400).json({
          message:
            "Thứ tự khu vực không hợp lệ",
        });
      }
    }

    /**
     * Tạo area.
     */
    const area =
      await TableArea.create({
        branch_id: branchId,
        name: String(name).trim(),
        sort_order:
          normalizedSortOrder,
      });

    return res.status(201).json({
      message:
        "Tạo khu vực thành công",
      data: area,
    });
  } catch (error) {
    console.error(
      "CREATE AREA ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể tạo khu vực",
    });
  }
};

/**
 * =========================================================
 * UPDATE AREA
 * =========================================================
 *
 * Admin:
 *      tất cả.
 *
 * Chain Manager:
 *      tất cả.
 *
 * Branch Manager:
 *      chỉ branch của mình.
 */
export const updateArea = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const branchId = Number(
      req.params.id
    );

    const areaId = Number(
      req.params.areaId
    );

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message:
          "branch_id không hợp lệ",
      });
    }

    if (!Number.isInteger(areaId)) {
      return res.status(400).json({
        message:
          "area_id không hợp lệ",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    /**
     * Kiểm tra branch isolation
     * TRƯỚC khi cho phép sửa area.
     */
    if (
      !canAccessBranch(
        req,
        branchId
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền thao tác khu vực của chi nhánh này",
      });
    }

    /**
     * Area bắt buộc phải thuộc đúng branch.
     */
    const area =
      await TableArea.findOne({
        where: {
          id: areaId,
          branch_id: branchId,
        },
      });

    if (!area) {
      return res.status(404).json({
        message:
          "Không tìm thấy khu vực",
      });
    }

    const {
      name,
      sort_order,
      is_active,
      status,
    } = req.body;

    /**
     * Cập nhật tên.
     */
    if (name !== undefined) {
      if (
        !String(name).trim()
      ) {
        return res.status(400).json({
          message:
            "Tên khu vực không được để trống",
        });
      }

      area.name =
        String(name).trim();
    }

    /**
     * Cập nhật thứ tự.
     */
    if (
      sort_order !== undefined
    ) {
      const order =
        Number(sort_order);

      if (
        !Number.isInteger(order) ||
        order < 0
      ) {
        return res.status(400).json({
          message:
            "Thứ tự khu vực không hợp lệ",
        });
      }

      area.sort_order = order;
    }

    /**
     * Hỗ trợ is_active
     * nếu model hiện tại sử dụng field này.
     */
    if (
      is_active !== undefined
    ) {
      if (
        typeof is_active !==
        "boolean"
      ) {
        return res.status(400).json({
          message:
            "is_active phải là boolean",
        });
      }

      area.is_active =
        is_active;
    }

    /**
     * Giữ tương thích với frontend cũ nếu gửi status hoặc is_active.
     * Model thực tế chỉ có is_active, nên không được gán status.
     */
    if (
      status !== undefined &&
      is_active === undefined
    ) {
      if (
        typeof status === "boolean"
      ) {
        area.is_active = status;
      } else if (
        typeof status === "string"
      ) {
        const normalized =
          status.toLowerCase();

        if (
          normalized === "active" ||
          normalized === "inactive"
        ) {
          area.is_active =
            normalized === "active";
        }
      }
    }

    await area.save();

    return res.status(200).json({
      message:
        "Cập nhật khu vực thành công",
      data: area,
    });
  } catch (error) {
    console.error(
      "UPDATE AREA ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể cập nhật khu vực",
    });
  }
};

/**
 * =========================================================
 * DELETE AREA
 * =========================================================
 *
 * Không cho xóa area nếu vẫn còn bàn.
 */
export const deleteArea = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const branchId = Number(
      req.params.id
    );

    const areaId = Number(
      req.params.areaId
    );

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message:
          "branch_id không hợp lệ",
      });
    }

    if (!Number.isInteger(areaId)) {
      return res.status(400).json({
        message:
          "area_id không hợp lệ",
      });
    }

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    /**
     * Branch isolation.
     */
    if (
      !canAccessBranch(
        req,
        branchId
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa khu vực của chi nhánh này",
      });
    }

    /**
     * Area phải thuộc đúng branch.
     */
    const area =
      await TableArea.findOne({
        where: {
          id: areaId,
          branch_id: branchId,
        },
      });

    if (!area) {
      return res.status(404).json({
        message:
          "Không tìm thấy khu vực",
      });
    }

    /**
     * Không cho xóa area nếu
     * vẫn còn bàn.
     */
    const tableCount =
      await Table.count({
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
      message:
        "Xóa khu vực thành công",
    });
  } catch (error) {
    console.error(
      "DELETE AREA ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể xóa khu vực",
    });
  }
};

/**
 * =========================================================
 * ASSIGN STAFF TO BRANCH
 * =========================================================
 *
 * Chức năng này chỉ dành cho:
 * - admin
 * - chain_manager
 *
 * Router phải bảo vệ bằng requireChainManager.
 */
export const assignStaff = async (
  req: Request,
  res: Response
) => {
  try {
    const branchId = Number(
      req.params.id
    );

    const userId = Number(
      req.body.user_id
    );

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message:
          "ID chi nhánh không hợp lệ",
      });
    }

    if (!Number.isInteger(userId)) {
      return res.status(400).json({
        message:
          "user_id không hợp lệ",
      });
    }

    const [branch, user] =
      await Promise.all([
        Branch.findByPk(branchId),
        User.findByPk(userId),
      ]);

    if (!branch || !user) {
      return res.status(404).json({
        message:
          "Không tìm thấy chi nhánh hoặc nhân viên",
      });
    }

    const isPrimary =
      Boolean(req.body.is_primary);

    const [
      assignment,
      created,
    ] = await StaffBranch.findOrCreate({
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
     * thì cập nhật.
     */
    if (!created) {
      await assignment.update({
        is_primary: isPrimary,

        is_active:
          req.body.is_active !==
          undefined
            ? Boolean(
                req.body.is_active
              )
            : true,
      });
    }

    return res.status(
      created ? 201 : 200
    ).json({
      data: assignment,
    });
  } catch (error) {
    console.error(
      "ASSIGN STAFF ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể phân công nhân viên",
    });
  }
};