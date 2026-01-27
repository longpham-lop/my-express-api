import OrderItem from "../models/OrderItem";
import { Request, Response } from "express";

export const getAllOrderItems = async (req: Request, res: Response) => {
  try {
    const items = await OrderItem.findAll();
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createOrderItem = async (req: Request, res: Response) => {
  try {
    const item = await OrderItem.create(req.body);
    res.status(201).json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
