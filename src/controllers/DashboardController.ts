import { Request, Response } from "express";
import Menu from "../models/Menu";
import Order from "../models/Order";
import Table from "../models/Table";

export const getDashboard = async (req: Request, res: Response) => {
  try {
    const menuCount = await Menu.count();
    const orderCount = await Order.count();
    const tableAvailable = await Table.count({
      where: { status: "available" },
    });

    res.json({
      menu: menuCount,
      orders: orderCount,
      tables: tableAvailable,
    });
  } catch (err: any) {
    res.status(500).json({
      message: "Lỗi server",
      error: err.message,
    });
  }
};