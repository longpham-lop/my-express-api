import { Request, Response } from "express";
import Role from "../models/Role";

export const getRoles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const roles = await Role.findAll({
      order: [["id", "ASC"]],
    });

    res.status(200).json(roles);
  } catch (error) {
    console.error("GET ROLES ERROR:", error);

    res.status(500).json({
      message: "Không thể lấy danh sách vai trò",
    });
  }
};