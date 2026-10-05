import { Request, Response } from "express";
import Table from "../models/Table";
import Reservation from "../models/Reservation";
import TableArea from "../models/TableArea";
import Branch from "../models/Branch";
import { AuthRequest } from "../middlewares/auth.middleware";

/**
 * =========================================================
 * ROLE HELPERS
 * =========================================================
 */

const GLOBAL_ROLES = ["admin", "chain_manager"];

const TABLE_MANAGER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const TABLE_VIEW_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
];

/**
 * Kiểm tra user có quyền quản lý toàn hệ thống hay không
 */
const isGlobalRole = (role: string) => {
  return GLOBAL_ROLES.includes(role);
};

/**
 * Kiểm tra user có quyền quản lý cấu trúc bàn hay không
 */
const isTableManager = (role: string) => {
  return TABLE_MANAGER_ROLES.includes(role);
};

/**
 * Kiểm tra user có quyền xem bàn hay không
 */
const isTableViewer = (role: string) => {
  return TABLE_VIEW_ROLES.includes(role);
};

/**
 * =========================================================
 * CREATE TABLE
 * =========================================================
 */

export const createTable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const { name, capacity, type, branch_id, area_id } = req.body;

    /**
     * Kiểm tra quyền
     */
    if (!isTableManager(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền tạo bàn",
      });
    }

    /**
     * Kiểm tra dữ liệu cơ bản
     */
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

    /**
     * Branch Manager chỉ được tạo bàn
     * trong chi nhánh của mình
     */
    if (req.user.role === "branch_manager") {
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (branchId !== req.user.branchId) {
        return res.status(403).json({
          message: "Bạn chỉ được tạo bàn trong chi nhánh của mình",
        });
      }
    }

    /**
     * Kiểm tra branch
     */
    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    /**
     * Xử lý area
     */
    const areaId =
      area_id !== undefined &&
      area_id !== null &&
      area_id !== ""
        ? Number(area_id)
        : null;

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

    /**
     * Tạo bàn
     */
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
  } catch (err) {
    console.error("CREATE TABLE ERROR:", err);

    return res.status(500).json({
      message: "Lỗi server khi tạo bàn",
    });
  }
};

/**
 * =========================================================
 * GET ALL TABLES
 * =========================================================
 */

export const getAllTable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!isTableViewer(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách bàn",
      });
    }

    const { role, branchId } = req.user;

    const whereCondition: {
      branch_id?: number;
    } = {};

    /**
     * Admin / Chain Manager
     *
     * Có thể:
     * - xem tất cả
     * - hoặc truyền ?branch_id=1
     */
    if (isGlobalRole(role)) {
      if (req.query.branch_id !== undefined) {
        const requestedBranchId = Number(req.query.branch_id);

        if (
          !Number.isInteger(requestedBranchId) ||
          requestedBranchId <= 0
        ) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        whereCondition.branch_id = requestedBranchId;
      }
    }

    /**
     * Branch Manager / Waiter
     *
     * Chỉ được xem branch của mình.
     */
    if (
      role === "branch_manager" ||
      role === "waiter"
    ) {
      if (!branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      whereCondition.branch_id = branchId;
    }

    const tables = await Table.findAll({
      where: whereCondition,
      order: [["id", "ASC"]],
    });

    return res.status(200).json(tables);
  } catch (err) {
    console.error("GET ALL TABLE ERROR:", err);

    return res.status(500).json({
      message: "Không thể lấy danh sách bàn",
    });
  }
};

/**
 * =========================================================
 * UPDATE TABLE STATUS
 * =========================================================
 *
 * Hiện tại chỉ cho nhóm quản lý bàn.
 *
 * Waiter chưa được mở quyền endpoint này.
 * Sau này nếu cần cho waiter vận hành bàn,
 * nên tạo endpoint riêng.
 */

export const updateStatus = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!isTableManager(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật trạng thái bàn",
      });
    }

    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Table id không hợp lệ",
      });
    }

    const validStatus = [
      "available",
      "reserved",
      "occupied",
    ];

    if (!validStatus.includes(status)) {
      return res.status(400).json({
        message: "Trạng thái bàn không hợp lệ",
      });
    }

    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        message: "Không tìm thấy bàn",
      });
    }

    /**
     * Branch Manager chỉ được thao tác
     * trên bàn thuộc branch của mình.
     */
    if (req.user.role === "branch_manager") {
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (table.branch_id !== req.user.branchId) {
        return res.status(403).json({
          message:
            "Bạn không có quyền thao tác bàn của chi nhánh khác",
        });
      }
    }

    await table.update({
      status,
    });

    return res.status(200).json({
      message: "Cập nhật trạng thái bàn thành công",
      data: table,
    });
  } catch (err) {
    console.error("UPDATE TABLE STATUS ERROR:", err);

    return res.status(500).json({
      message: "Lỗi server khi cập nhật trạng thái bàn",
    });
  }
};

/**
 * =========================================================
 * GET TABLE BY ID
 * =========================================================
 */

export const getTableById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!isTableViewer(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem thông tin bàn",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Table id không hợp lệ",
      });
    }

    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        message: "Không tìm thấy bàn",
      });
    }

    /**
     * Branch Manager / Waiter
     * chỉ được xem bàn của branch mình.
     */
    if (
      req.user.role === "branch_manager" ||
      req.user.role === "waiter"
    ) {
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (table.branch_id !== req.user.branchId) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xem bàn của chi nhánh khác",
        });
      }
    }

    return res.status(200).json(table);
  } catch (err) {
    console.error("GET TABLE BY ID ERROR:", err);

    return res.status(500).json({
      message: "Không thể lấy thông tin bàn",
    });
  }
};

/**
 * =========================================================
 * UPDATE FULL TABLE
 * =========================================================
 */

export const updateTable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!isTableManager(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền sửa bàn",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Table id không hợp lệ",
      });
    }

    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        message: "Không tìm thấy bàn",
      });
    }

    /**
     * Branch Manager chỉ được sửa
     * bàn thuộc branch của mình.
     */
    if (req.user.role === "branch_manager") {
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (table.branch_id !== req.user.branchId) {
        return res.status(403).json({
          message:
            "Bạn không có quyền sửa bàn của chi nhánh khác",
        });
      }

      /**
       * Không cho branch_manager đổi
       * branch_id sang chi nhánh khác.
       */
      if (
        req.body.branch_id !== undefined &&
        Number(req.body.branch_id) !== req.user.branchId
      ) {
        return res.status(403).json({
          message:
            "Bạn không thể chuyển bàn sang chi nhánh khác",
        });
      }
    }

    /**
     * Nếu có area_id thì phải thuộc
     * đúng branch của table.
     */
    if (
      req.body.area_id !== undefined &&
      req.body.area_id !== null &&
      req.body.area_id !== ""
    ) {
      const areaId = Number(req.body.area_id);

      if (!Number.isInteger(areaId)) {
        return res.status(400).json({
          message: "Khu vực không hợp lệ",
        });
      }

      const area = await TableArea.findOne({
        where: {
          id: areaId,
          branch_id: table.branch_id,
        },
      });

      if (!area) {
        return res.status(400).json({
          message:
            "Khu vực không thuộc chi nhánh của bàn",
        });
      }
    }

    /**
     * Chỉ update những field cho phép.
     * Không cho client tự ý update các field
     * ngoài phạm vi của Table.
     */
    const updateData: {
      name?: string;
      capacity?: number;
      type?: "normal" | "vip";
      branch_id?: number;
      area_id?: number | null;
      status?: "available" | "reserved" | "occupied";
    } = {};

    if (req.body.name !== undefined) {
      if (
        typeof req.body.name !== "string" ||
        !req.body.name.trim()
      ) {
        return res.status(400).json({
          message: "Tên bàn không hợp lệ",
        });
      }

      updateData.name = req.body.name.trim();
    }

    if (req.body.capacity !== undefined) {
      const capacity = Number(req.body.capacity);

      if (
        !Number.isInteger(capacity) ||
        capacity <= 0
      ) {
        return res.status(400).json({
          message: "Sức chứa không hợp lệ",
        });
      }

      updateData.capacity = capacity;
    }

    if (req.body.type !== undefined) {
      updateData.type =
        req.body.type === "vip"
          ? "vip"
          : "normal";
    }

    if (req.body.area_id !== undefined) {
      updateData.area_id =
        req.body.area_id === null ||
        req.body.area_id === ""
          ? null
          : Number(req.body.area_id);
    }

    /**
     * Chỉ global role mới được đổi branch_id.
     */
    if (
      req.body.branch_id !== undefined &&
      isGlobalRole(req.user.role)
    ) {
      const branchId = Number(req.body.branch_id);

      if (
        !Number.isInteger(branchId) ||
        branchId <= 0
      ) {
        return res.status(400).json({
          message: "Chi nhánh không hợp lệ",
        });
      }

      const branch = await Branch.findByPk(branchId);

      if (!branch) {
        return res.status(404).json({
          message: "Không tìm thấy chi nhánh",
        });
      }

      /**
       * Nếu đổi branch thì area phải thuộc
       * branch mới.
       */
      if (
        updateData.area_id !== undefined &&
        updateData.area_id !== null
      ) {
        const area = await TableArea.findOne({
          where: {
            id: updateData.area_id,
            branch_id: branchId,
          },
        });

        if (!area) {
          return res.status(400).json({
            message:
              "Khu vực không thuộc chi nhánh mới",
          });
        }
      }

      updateData.branch_id = branchId;
    }

    if (req.body.status !== undefined) {
      const validStatus = [
        "available",
        "reserved",
        "occupied",
      ];

      if (!validStatus.includes(req.body.status)) {
        return res.status(400).json({
          message: "Trạng thái bàn không hợp lệ",
        });
      }

      updateData.status = req.body.status;
    }

    await table.update(updateData);

    return res.status(200).json({
      message: "Cập nhật bàn thành công",
      data: table,
    });
  } catch (err) {
    console.error("UPDATE TABLE ERROR:", err);

    return res.status(500).json({
      message: "Lỗi server khi cập nhật bàn",
    });
  }
};

/**
 * =========================================================
 * DELETE TABLE
 * =========================================================
 */

export const deleteTable = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!isTableManager(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa bàn",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "Table id không hợp lệ",
      });
    }

    const table = await Table.findByPk(id);

    if (!table) {
      return res.status(404).json({
        message: "Không tìm thấy bàn",
      });
    }

    /**
     * Branch Manager chỉ được xóa
     * bàn thuộc branch của mình.
     */
    if (req.user.role === "branch_manager") {
      if (!req.user.branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (table.branch_id !== req.user.branchId) {
        return res.status(403).json({
          message:
            "Bạn không có quyền xóa bàn của chi nhánh khác",
        });
      }
    }

    /**
     * Xóa reservation liên quan trước
     */
    await Reservation.destroy({
      where: {
        table_id: id,
      },
    });

    /**
     * Xóa bàn
     */
    await table.destroy();

    return res.status(200).json({
      message: "Xóa bàn thành công",
    });
  } catch (err) {
    console.error("DELETE TABLE ERROR:", err);

    return res.status(500).json({
      message: "Lỗi server khi xóa bàn",
    });
  }
};