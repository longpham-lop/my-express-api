import jwt from "jsonwebtoken";
import { User } from "../models";
import { Request, Response } from "express";
import bcrypt from "bcrypt";

// LOGIN
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // tìm user
    const user = await User.findOne({
      where: { email },
    });

    // không tồn tại
    if (!user) {
      return res.status(400).json({
        message: "Sai email hoặc mật khẩu",
      });
    }

    // kiểm tra password
    const isMatch = await bcrypt.compare(
      password,
      user.getDataValue("password")
    );

    if (!isMatch) {
      return res.status(400).json({
        message: "Sai email hoặc mật khẩu",
      });
    }

    // lấy role thật
    const role =
      user.getDataValue("role_id") === 1
        ? "admin"
        : "user";

    console.log("LOGIN ROLE:", user.getDataValue("role_id"));

    // tạo token
    const token = jwt.sign(
      {
        id: user.getDataValue("id"),
        role,
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "1d",
      }
    );

    // trả dữ liệu
    return res.json({
      token,
      user: {
        id: user.get("id"),
        name: user.get("name"),
        email: user.get("email"),
        role,
      },
    });
  } catch (err: any) {
    console.log("login error:", err);

    return res.status(500).json({
      error: err.message,
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
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role_id: 1,
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