import { Request, Response } from "express";
import bcrypt from "bcrypt";

import User from "../models/User";
import Role from "../models/Role";
import Branch from "../models/Branch";

/* =====================================================
   CREATE USER
===================================================== */

export const createUser = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      role_id,
      branch_id,
      status,
    } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!name || !email || !password || !role_id) {
      return res.status(400).json({
        message: "name, email, password và role_id là bắt buộc",
      });
    }

    // Kiểm tra email đã tồn tại
    const exist = await User.findOne({
      where: { email },
    });

    if (exist) {
      return res.status(409).json({
        message: "Email đã tồn tại",
      });
    }

    // Kiểm tra Role
    const role = await Role.findByPk(Number(role_id));

    if (!role) {
      return res.status(400).json({
        message: "Role không tồn tại",
      });
    }

    // Nếu có branch_id thì kiểm tra chi nhánh
    if (branch_id !== undefined && branch_id !== null) {
      const branch = await Branch.findByPk(Number(branch_id));

      if (!branch) {
        return res.status(400).json({
          message: "Chi nhánh không tồn tại",
        });
      }
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Tạo user
    const user = await User.create({
      name,
      email,
      password: hashed,
      role_id: Number(role_id),
      branch_id:
        branch_id === undefined || branch_id === null
          ? null
          : Number(branch_id),
      status: status || "active",
    });

    // Lấy lại user kèm Role + Branch
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

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await User.findAll({
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

export const getUserById = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

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

export const updateUser = async (req: Request, res: Response) => {
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

    // Tìm user
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        message: "Nhân viên không tồn tại",
      });
    }

    // Kiểm tra email trùng
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

    // Kiểm tra Role
    if (role_id !== undefined) {
      const role = await Role.findByPk(Number(role_id));

      if (!role) {
        return res.status(400).json({
          message: "Role không tồn tại",
        });
      }

      user.role_id = Number(role_id);
    }

    // Kiểm tra Branch
    if (branch_id !== undefined) {
      if (branch_id === null) {
        user.branch_id = null;
      } else {
        const branch = await Branch.findByPk(Number(branch_id));

        if (!branch) {
          return res.status(400).json({
            message: "Chi nhánh không tồn tại",
          });
        }

        user.branch_id = Number(branch_id);
      }
    }

    // Cập nhật thông tin
    if (name !== undefined) {
      user.name = name;
    }

    if (email !== undefined) {
      user.email = email;
    }

    if (status !== undefined) {
      user.status = status;
    }

    // Nếu nhập password mới thì hash lại
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    // Lấy lại dữ liệu sau khi update
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

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        message: "Nhân viên không tồn tại",
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