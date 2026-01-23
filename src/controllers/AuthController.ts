import type { Request, Response } from "express";

export const register = (req: Request, res: Response) => {
  res.json({ message: "Register user" });
};

export const login = (req: Request, res: Response) => {
  res.json({ message: "Login user" });
};
export const logout = (req: Request, res: Response) => {
  res.json({ message: "Logout user" });
}