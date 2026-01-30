import jwt from "jsonwebtoken";
import User from "../models/User";
import { Request, Response } from "express";

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = (await User.findOne({
      where: { email },
    })) as InstanceType<typeof User> | null;

    if (!user) {
      return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
    }

    if (user.getDataValue("password") !== password) {
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
