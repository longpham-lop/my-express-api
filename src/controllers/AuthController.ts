import jwt from "jsonwebtoken";
import User from "../models/User";
import Role from "../models/Role";
import { Request, Response } from "express";
import bcrypt from "bcrypt";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = (await User.findOne({
      where: { email },
    })) as InstanceType<typeof User> | null;

    if (!user) {
      return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
    }
     const isMatch = await bcrypt.compare(
      password,                      // password nhập
      user.getDataValue("password")  // password đã hash
    );

    if (!isMatch) {
      return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
    }
    const token = jwt.sign(
      {
        id: user.getDataValue("id"),
        role_id: user.getDataValue("role_id"),
      },
      process.env.JWT_SECRET!,
      { expiresIn: "1d" }
    );

    res.json({ token });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    // 1️⃣ Validate
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "name, email, password là bắt buộc",
      });
    }

    // 2️⃣ Check email tồn tại
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    // 3️⃣ HASH password
    const hashedPassword = await bcrypt.hash(password, 10);
    // 10 = saltRounds (chuẩn)

    // 4️⃣ Tạo user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role_id: 1, // USER
    });

    // 5️⃣ Không trả password
    return res.status(201).json({
      id: user.get("id"),
      name: user.get("name"),
      email: user.get("email"),
      role_id: user.get("role_id"),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};