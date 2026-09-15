import { Response } from "express";
import bcrypt from "bcrypt";

import User from "../models/User";
import Role from "../models/Role";
import Branch from "../models/Branch";

import { AuthRequest } from "../middlewares/auth.middleware";

/* =====================================================
   HELPER
===================================================== */

const isGlobalRole = (role?: string) => {
  return role === "admin" || role === "chain_manager";
};

const isBranchManager = (role?: string) => {
  return role === "branch_manager";
};

/* =====================================================
   CREATE USER
===================================================== */

export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      role_id,
      branch_id,
      status,
    } = req.body;

    if (!name || !email || !password || !role_id) {
      return res.status(400).json({
        message: "name, email, password và role_id là bắt buộc",
      });
    }

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    /* =================================================
       BRANCH MANAGER
    ================================================= */

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản quản lý chi nhánh chưa được gán chi nhánh",
        });
      }

      // Không cho branch_manager tự chọn chi nhánh khác
      if (
        branch_id !== undefined &&
        branch_id !== null &&
        Number(branch_id) !== currentBranchId
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền tạo nhân viên cho chi nhánh khác",
        });
      }
    }

    /* =================================================
       KIỂM TRA EMAIL
    ================================================= */

    const exist = await User.findOne({
      where: { email },
    });

    if (exist) {
      return res.status(409).json({
        message: "Email đã tồn tại",
      });
    }

    /* =================================================
       KIỂM TRA ROLE
    ================================================= */

    const role = await Role.findByPk(Number(role_id));

    if (!role) {
      return res.status(400).json({
        message: "Role không tồn tại",
      });
    }

    /* =================================================
       KHÔNG CHO BRANCH MANAGER TẠO QUẢN LÝ
    ================================================= */

    if (
      isBranchManager(currentRole) &&
      ["admin", "chain_manager", "branch_manager"].includes(role.name)
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền tạo tài khoản quản lý",
      });
    }

    /* =================================================
       XÁC ĐỊNH BRANCH
    ================================================= */

    let finalBranchId: number | null = null;

    if (isGlobalRole(currentRole)) {
      // Admin / chain_manager có thể chọn branch
      if (branch_id !== undefined && branch_id !== null) {
        const branch = await Branch.findByPk(Number(branch_id));

        if (!branch) {
          return res.status(400).json({
            message: "Chi nhánh không tồn tại",
          });
        }

        finalBranchId = Number(branch_id);
      }
    } else if (isBranchManager(currentRole)) {
      // Branch manager bắt buộc thuộc chi nhánh của mình
      finalBranchId = currentBranchId ?? null;
    }

    /* =================================================
       HASH PASSWORD
    ================================================= */

    const hashed = await bcrypt.hash(password, 10);

    /* =================================================
       TẠO USER
    ================================================= */

    const user = await User.create({
      name,
      email,
      password: hashed,
      role_id: Number(role_id),
      branch_id: finalBranchId,
      status: status || "active",
    });

    /* =================================================
       LẤY USER SAU KHI TẠO
    ================================================= */

    const createdUser = await User.findByPk(user.id, {
      attributes: {
        exclude: ["password"],
      },

      include: [
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
      ],
    });

    return res.status(201).json({
      message: "Tạo nhân viên thành công",
      user: createdUser,
    });
  } catch (err) {
    console.error("CREATE USER ERROR:", err);

    return res.status(500).json({
      message: "Không thể tạo nhân viên",
    });
  }
};

/* =====================================================
   GET ALL USERS
===================================================== */

export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    let whereCondition = {};

    /* =================================================
       BRANCH MANAGER CHỈ XEM USER CÙNG CHI NHÁNH
    ================================================= */

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      whereCondition = {
        branch_id: currentBranchId,
      };
    }

    const users = await User.findAll({
      where: whereCondition,

      attributes: {
        exclude: ["password"],
      },

      include: [
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
      ],

      order: [["id", "DESC"]],
    });

    return res.status(200).json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);

    return res.status(500).json({
      message: "Không thể lấy danh sách nhân viên",
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

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    const user = await User.findByPk(id, {
      attributes: {
        exclude: ["password"],
      },

      include: [
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
      ],
    });

    if (!user) {
      return res.status(404).json({
        message: "Nhân viên không tồn tại",
      });
    }

    /* =================================================
       KIỂM TRA BRANCH ISOLATION
    ================================================= */

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (user.branch_id !== currentBranchId) {
        return res.status(403).json({
          message: "Bạn không có quyền xem nhân viên chi nhánh khác",
        });
      }
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error("GET USER BY ID ERROR:", err);

    return res.status(500).json({
      message: "Không thể lấy thông tin nhân viên",
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

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
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

    /* =================================================
       TÌM USER
    ================================================= */

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        message: "Nhân viên không tồn tại",
      });
    }

    /* =================================================
       BRANCH ISOLATION
    ================================================= */

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (user.branch_id !== currentBranchId) {
        return res.status(403).json({
          message: "Bạn không có quyền sửa nhân viên chi nhánh khác",
        });
      }

      // Không cho sửa sang chi nhánh khác
      if (
        branch_id !== undefined &&
        branch_id !== null &&
        Number(branch_id) !== currentBranchId
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền chuyển nhân viên sang chi nhánh khác",
        });
      }

      // Không cho branch manager bỏ branch
      if (branch_id === null) {
        return res.status(403).json({
          message: "Nhân viên phải thuộc một chi nhánh",
        });
      }
    }

    /* =================================================
       KIỂM TRA EMAIL
    ================================================= */

    if (email && email !== user.email) {
      const exist = await User.findOne({
        where: { email },
      });

      if (exist) {
        return res.status(409).json({
          message: "Email đã được sử dụng",
        });
      }
    }

    /* =================================================
       KIỂM TRA ROLE
    ================================================= */

    if (role_id !== undefined) {
      const role = await Role.findByPk(Number(role_id));

      if (!role) {
        return res.status(400).json({
          message: "Role không tồn tại",
        });
      }

      if (
        isBranchManager(currentRole) &&
        ["admin", "chain_manager", "branch_manager"].includes(role.name)
      ) {
        return res.status(403).json({
          message: "Bạn không có quyền gán vai trò quản lý",
        });
      }

      user.role_id = Number(role_id);
    }

    /* =================================================
       KIỂM TRA BRANCH
    ================================================= */

    if (branch_id !== undefined) {
      if (branch_id === null) {
        if (isBranchManager(currentRole)) {
          return res.status(403).json({
            message: "Không thể bỏ chi nhánh của nhân viên",
          });
        }

        user.branch_id = null;
      } else {
        const branch = await Branch.findByPk(Number(branch_id));

        if (!branch) {
          return res.status(400).json({
            message: "Chi nhánh không tồn tại",
          });
        }

        if (
          isBranchManager(currentRole) &&
          Number(branch_id) !== currentBranchId
        ) {
          return res.status(403).json({
            message: "Bạn không có quyền chuyển nhân viên sang chi nhánh khác",
          });
        }

        user.branch_id = Number(branch_id);
      }
    }

    /* =================================================
       UPDATE INFO
    ================================================= */

    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email;
    }

    if (status !== undefined) {
      user.status = status;
    }

    /* =================================================
       UPDATE PASSWORD
    ================================================= */

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    /* =================================================
       LẤY USER SAU UPDATE
    ================================================= */

    const updatedUser = await User.findByPk(user.id, {
      attributes: {
        exclude: ["password"],
      },

      include: [
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
      ],
    });

    return res.status(200).json({
      message: "Cập nhật nhân viên thành công",
      user: updatedUser,
    });
  } catch (err) {
    console.error("UPDATE USER ERROR:", err);

    return res.status(500).json({
      message: "Không thể cập nhật nhân viên",
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

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const currentRole = req.user?.role;
    const currentBranchId = req.user?.branchId;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        message: "Nhân viên không tồn tại",
      });
    }

    /* =================================================
       BRANCH ISOLATION
    ================================================= */

    if (isBranchManager(currentRole)) {
      if (!currentBranchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (user.branch_id !== currentBranchId) {
        return res.status(403).json({
          message: "Bạn không có quyền xóa nhân viên chi nhánh khác",
        });
      }
    }

    /* =================================================
       KHÔNG CHO TỰ XÓA
    ================================================= */

    if (req.user?.id === user.id) {
      return res.status(403).json({
        message: "Bạn không thể tự xóa tài khoản của mình",
      });
    }

    await user.destroy();

    return res.status(200).json({
      message: "Xóa nhân viên thành công",
    });
  } catch (err) {
    console.error("DELETE USER ERROR:", err);

    return res.status(500).json({
      message: "Không thể xóa nhân viên",
    });
  }
};