import type { Request, Response } from "express";

export const getTables = (req: Request, res: Response) => {
  res.json({ tables: [] });
};

export const createTable = (req: Request, res: Response) => {
  res.json({ message: "Create table" });
};
