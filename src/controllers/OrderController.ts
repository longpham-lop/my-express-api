import Order from "../models/Order";
import { Request, Response } from "express";

export const getAllOrders = async (req: Request, res: Response) => {
  try {
    const orders = await Order.findAll();
    res.json(orders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const order = await Order.create(req.body);
    res.status(201).json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

