import jwt from "jsonwebtoken";
import { Role, User } from "../models";
import { Request, Response } from "express";
import bcrypt from "bcrypt";

// LOGIN
// LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // 1. Kiểm tra dữ liệu đầu vào
    if (!email || !password) {
      return res.status(400).json({
        message: "Email và mật khẩu là bắt buộc",
      });
    }

    // 2. Tìm user theo email
    const user = await User.findOne({
      where: { email },
      include: [
        {
          model: Role,
          as: "role",
          attributes: ["id", "name"],
        },
      ],
    });

    // 3. Không tìm thấy user
    if (!user) {
      return res.status(400).json({
        message: "Sai email hoặc mật khẩu",
      });
    }

    // 4. Kiểm tra trạng thái tài khoản
    const status = user.getDataValue("status");

    if (status !== "active") {
      return res.status(403).json({
        message: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    // 5. Kiểm tra password
    const isMatch = await bcrypt.compare(
      password,
      user.getDataValue("password")
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Sai email hoặc mật khẩu",
      });
    }

    // 6. Lấy role từ database
    const role = user.role?.name || "user";

    // 7. Lấy branch_id
    const branchId = user.getDataValue("branch_id");

    console.log("========== LOGIN ==========");
    console.log("User ID:", user.getDataValue("id"));
    console.log("Role:", role);
    console.log("Branch ID:", branchId);
    console.log("============================");

    // 8. Tạo JWT
    const token = jwt.sign(
      {
        id: user.getDataValue("id"),
        role,
        branchId: branchId ?? null,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1d",
      }
    );

    // 9. Trả dữ liệu về frontend
    return res.json({
      token,
      user: {
        id: user.getDataValue("id"),
        name: user.getDataValue("name"),
        email: user.getDataValue("email"),
        role,
        branchId: branchId ?? null,
      },
    });
  } catch (err: unknown) {
    console.log("login error:", err);

    const errorMessage =
      err instanceof Error ? err.message : "Đã xảy ra lỗi khi đăng nhập";

    return res.status(500).json({
      message: errorMessage,
    });
  }
};

// REGISTER
export const register = async (
  req: Request,
  res: Response
) => {
  try {
    const { name, email, password } = req.body;

    // validate
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, password là bắt buộc",
      });
    }

    // check email tồn tại
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Email đã tồn tại",
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    // tạo admin
    const defaultRole = await Role.findOne({ where: { name: "customer" } }) || await Role.findOne({ where: { name: "user" } });
    if (!defaultRole) {
      return res.status(500).json({ message: "Chưa khởi tạo vai trò mặc định" });
    }

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role_id: defaultRole.id,
    });

    console.log("REGISTER ROLE:", user.get("role_id"));

    // response
    return res.status(201).json({
      id: user.get("id"),
      name: user.get("name"),
      email: user.get("email"),
      role_id: user.get("role_id"),
    });
  } catch (err: any) {
    console.log("register error:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
};
