import Reservation from "../models/Reservation";
import { Request, Response } from "express";

export const getAllReservations = async (req: Request, res: Response) => {
  try {
    const data = await Reservation.findAll();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const createReservation = async (req: Request, res: Response) => {
  try {
    const reservation = await Reservation.create(req.body);
    res.status(201).json(reservation);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
