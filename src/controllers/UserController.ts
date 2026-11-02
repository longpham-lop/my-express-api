
import { Response } from "express";
import bcrypt from "bcrypt";
import { Op } from "sequelize";

import User from "../models/User";
import Role from "../models/Role";
import Branch from "../models/Branch";
import { AuthRequest } from "../middlewares/auth.middleware";

/* =====================================================
   ROLE CONFIGURATION
===================================================== */

const GLOBAL_ROLES = ["admin", "chain_manager"];

const STAFF_ROLES = ["waiter", "kitchen", "cashier"];

const CHAIN_MANAGER_ALLOWED_ROLES = [
  "branch_manager",
  ...STAFF_ROLES,
];

const BRANCH_MANAGER_ALLOWED_ROLES = STAFF_ROLES;

const isAdmin = (role?: string): boolean => role === "admin";

const isChainManager = (role?: string): boolean =>
  role === "chain_manager";

const isBranchManager = (role?: string): boolean =>
  role === "branch_manager";

const isGlobalRole = (role?: string): boolean =>
  GLOBAL_ROLES.includes(role ?? "");

const isStaffRole = (role?: string): boolean =>
  STAFF_ROLES.includes(role ?? "");

const isBranchAssignedRole = (role?: string): boolean =>
  role === "branch_manager" || isStaffRole(role);

const isValidStatus = (
  status: unknown
): status is "active" | "inactive" =>
  status === "active" || status === "inactive";

const includeUserRelations = [
  {
    model: Role,
    as: "role",
    attributes: ["id", "name"],
  },
  {
    model: Branch,
    as: "branch",
    attributes: ["id", "name", "code"],
  },
];

/* =====================================================
   CHECK TARGET USER PERMISSION
===================================================== */

const canManageTarget = (
  currentRole: string | undefined,
  targetRole: string
): boolean => {
  if (isAdmin(currentRole)) {
    return true;
  }

  if (isChainManager(currentRole)) {
    return CHAIN_MANAGER_ALLOWED_ROLES.includes(targetRole);
  }

  if (isBranchManager(currentRole)) {
    return BRANCH_MANAGER_ALLOWED_ROLES.includes(targetRole);
  }

  return false;
};

const canAssignRole = (
  currentRole: string | undefined,
  targetRole: string
): boolean => {
  if (isAdmin(currentRole)) {
    return true;
  }

  if (isChainManager(currentRole)) {
    return CHAIN_MANAGER_ALLOWED_ROLES.includes(targetRole);
  }

  if (isBranchManager(currentRole)) {
    return BRANCH_MANAGER_ALLOWED_ROLES.includes(targetRole);
  }

  return false;
};

/* =====================================================
   CREATE USER
===================================================== */

export const createUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      role_id,
      branch_id,
      status,
    } = req.body;

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    if (!name || !email || !password || role_id === undefined) {
      return res.status(400).json({
        message: "Vui lòng nhập đầy đủ họ tên, email, mật khẩu và vai trò",
      });
    }

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !name.trim() ||
      !email.trim() ||
      password.length < 6
    ) {
      return res.status(400).json({
        message: "Thông tin không hợp lệ hoặc mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    if (status !== undefined && !isValidStatus(status)) {
      return res.status(400).json({
        message: "Trạng thái chỉ được là active hoặc inactive",
      });
    }

    const parsedRoleId = Number(role_id);

    if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
      return res.status(400).json({
        message: "Role ID không hợp lệ",
      });
    }

    const role = await Role.findByPk(parsedRoleId);

    if (!role) {
      return res.status(400).json({
        message: "Vai trò không tồn tại",
      });
    }

    if (!canAssignRole(currentRole, role.name)) {
      return res.status(403).json({
        message: "Bạn không có quyền tạo tài khoản với vai trò này",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Email đã tồn tại",
      });
    }

    let finalBranchId: number | null = null;

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản quản lý chưa được gắn chi nhánh",
        });
      }

      if (
        branch_id !== undefined &&
        branch_id !== null &&
        Number(branch_id) !== currentBranchId
      ) {
        return res.status(403).json({
          message: "Bạn không được tạo nhân viên cho chi nhánh khác",
        });
      }

      finalBranchId = currentBranchId;
    } else if (branch_id !== undefined && branch_id !== null) {
      const parsedBranchId = Number(branch_id);

      if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
        return res.status(400).json({
          message: "Chi nhánh không hợp lệ",
        });
      }

      const branch = await Branch.findByPk(parsedBranchId);

      if (!branch) {
        return res.status(400).json({
          message: "Chi nhánh không tồn tại",
        });
      }

      finalBranchId = parsedBranchId;
    }

    if (isBranchAssignedRole(role.name) && !finalBranchId) {
      return res.status(400).json({
        message: "Tài khoản quản lý chi nhánh và nhân viên phải được gắn chi nhánh",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role_id: parsedRoleId,
      branch_id: finalBranchId,
      status: status ?? "active",
    });

    const createdUser = await User.findByPk(user.id, {
      attributes: { exclude: ["password"] },
      include: includeUserRelations,
    });

    return res.status(201).json({
      message: "Tạo tài khoản thành công",
      user: createdUser,
    });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);

    return res.status(500).json({
      message: "Không thể tạo tài khoản",
    });
  }
};

/* =====================================================
   GET ALL USERS
===================================================== */

export const getUsers = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    if (!isAdmin(currentRole) && !isChainManager(currentRole) &&
        !isBranchManager(currentRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách tài khoản",
      });
    }

    const whereCondition = isBranchManager(currentRole)
      ? { branch_id: currentBranchId ?? -1 }
      : {};

    if (isBranchManager(currentRole) && !currentBranchId) {
      return res.status(403).json({
        message: "Tài khoản quản lý chưa được gắn chi nhánh",
      });
    }

    const users = await User.findAll({
      where: whereCondition,
      attributes: { exclude: ["password"] },
      include: includeUserRelations,
      order: [["id", "DESC"]],
    });

    return res.status(200).json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);

    return res.status(500).json({
      message: "Không thể lấy danh sách tài khoản",
    });
  }
};

/* =====================================================
   GET USER BY ID
===================================================== */

export const getUserById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID tài khoản không hợp lệ",
      });
    }

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    const user = await User.findByPk(id, {
      attributes: { exclude: ["password"] },
      include: includeUserRelations,
    });

    if (!user) {
      return res.status(404).json({
        message: "Tài khoản không tồn tại",
      });
    }

    const targetRole = user.role?.name;

    if (!targetRole || !canManageTarget(currentRole, targetRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem tài khoản này",
      });
    }

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản quản lý chưa được gắn chi nhánh",
        });
      }

      if (user.branch_id !== currentBranchId) {
        return res.status(403).json({
          message: "Bạn không có quyền xem tài khoản chi nhánh khác",
        });
      }
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error("GET USER BY ID ERROR:", err);

    return res.status(500).json({
      message: "Không thể lấy thông tin tài khoản",
    });
  }
};

/* =====================================================
   UPDATE USER
===================================================== */

export const updateUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID tài khoản không hợp lệ",
      });
    }

    const {
      name,
      email,
      password,
      role_id,
      branch_id,
      status,
    } = req.body;

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;
    const currentUserId = req.user?.id;

    const user = await User.findByPk(id, {
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        message: "Tài khoản không tồn tại",
      });
    }

    const oldRole = user.role?.name;

    if (!oldRole || !canManageTarget(currentRole, oldRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền chỉnh sửa tài khoản này",
      });
    }

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản quản lý chưa được gắn chi nhánh",
        });
      }

      if (user.branch_id !== currentBranchId) {
        return res.status(403).json({
          message: "Bạn không có quyền chỉnh sửa nhân viên chi nhánh khác",
        });
      }
    }

    // Không cho người dùng tự thay đổi vai trò hoặc chi nhánh của mình.
    if (
      currentUserId === user.id &&
      (role_id !== undefined || branch_id !== undefined)
    ) {
      return res.status(403).json({
        message: "Bạn không thể tự thay đổi vai trò hoặc chi nhánh của mình",
      });
    }

    let newRoleName = oldRole;

    if (role_id !== undefined) {
      const parsedRoleId = Number(role_id);

      if (!Number.isInteger(parsedRoleId) || parsedRoleId <= 0) {
        return res.status(400).json({
          message: "Role ID không hợp lệ",
        });
      }

      const newRole = await Role.findByPk(parsedRoleId);

      if (!newRole) {
        return res.status(400).json({
          message: "Vai trò không tồn tại",
        });
      }

      if (!canAssignRole(currentRole, newRole.name)) {
        return res.status(403).json({
          message: "Bạn không có quyền gán vai trò này",
        });
      }

      newRoleName = newRole.name;
      user.role_id = newRole.id;
    }

    // Không cho đổi email thành email đã được sử dụng.
    if (email !== undefined) {
      if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
          message: "Email không hợp lệ",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail !== user.email.toLowerCase()) {
        const existingUser = await User.findOne({
          where: {
            email: normalizedEmail,
            id: { [Op.ne]: user.id },
          },
        });

        if (existingUser) {
          return res.status(409).json({
            message: "Email đã được sử dụng",
          });
        }
      }

      user.email = normalizedEmail;
    }

    // Kiểm tra chi nhánh mới.
    if (branch_id !== undefined) {
      if (branch_id === null) {
        if (isBranchAssignedRole(newRoleName)) {
          return res.status(400).json({
            message: "Quản lý chi nhánh và nhân viên phải được gắn chi nhánh",
          });
        }

        if (!isAdmin(currentRole)) {
          return res.status(403).json({
            message: "Bạn không có quyền gỡ tài khoản khỏi chi nhánh",
          });
        }

        user.branch_id = null;
      } else {
        const parsedBranchId = Number(branch_id);

        if (!Number.isInteger(parsedBranchId) || parsedBranchId <= 0) {
          return res.status(400).json({
            message: "Chi nhánh không hợp lệ",
          });
        }

        if (
          isBranchManager(currentRole) &&
          parsedBranchId !== currentBranchId
        ) {
          return res.status(403).json({
            message: "Bạn không được chuyển nhân viên sang chi nhánh khác",
          });
        }

        const branch = await Branch.findByPk(parsedBranchId);

        if (!branch) {
          return res.status(400).json({
            message: "Chi nhánh không tồn tại",
          });
        }

        user.branch_id = parsedBranchId;
      }
    }

    if (isBranchAssignedRole(newRoleName) && !user.branch_id) {
      return res.status(400).json({
        message: "Tài khoản quản lý chi nhánh và nhân viên phải được gắn chi nhánh",
      });
    }

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          message: "Họ tên không hợp lệ",
        });
      }

      user.name = name.trim();
    }

    if (status !== undefined) {
      if (!isValidStatus(status)) {
        return res.status(400).json({
          message: "Trạng thái chỉ được là active hoặc inactive",
        });
      }

      user.status = status;
    }

    if (password !== undefined && password !== "") {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({
          message: "Mật khẩu phải có ít nhất 6 ký tự",
        });
      }

      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    const updatedUser = await User.findByPk(user.id, {
      attributes: { exclude: ["password"] },
      include: includeUserRelations,
    });

    return res.status(200).json({
      message: "Cập nhật tài khoản thành công",
      user: updatedUser,
    });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);

    return res.status(500).json({
      message: "Không thể cập nhật tài khoản",
    });
  }
};

/* =====================================================
   DELETE USER
===================================================== */

export const deleteUser = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        message: "ID tài khoản không hợp lệ",
      });
    }

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;
    const currentUserId = req.user?.id;

    const user = await User.findByPk(id, {
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["id", "name"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        message: "Tài khoản không tồn tại",
      });
    }

    if (currentUserId === user.id) {
      return res.status(403).json({
        message: "Bạn không thể tự xóa tài khoản của mình",
      });
    }

    const targetRole = user.role?.name;

    if (!targetRole || !canManageTarget(currentRole, targetRole)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa tài khoản này",
      });
    }

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản quản lý chưa được gắn chi nhánh",
        });
      }

      if (user.branch_id !== currentBranchId) {
        return res.status(403).json({
          message: "Bạn không có quyền xóa nhân viên chi nhánh khác",
        });
      }
    }

    await user.destroy();

    return res.status(200).json({
      message: "Xóa tài khoản thành công",
    });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);

    return res.status(500).json({
      message: "Không thể xóa tài khoản",
    });
  }
};
