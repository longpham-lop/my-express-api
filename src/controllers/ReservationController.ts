import { Request, Response } from "express";
import { Reservation } from "../models/Reservation";

export class ReservationController {
  static async create(req: Request, res: Response) {
    res.status(201).json(await Reservation.create(req.body));
  }
  static async cancel(req: Request, res: Response) {
    await Reservation.cancel(Number(req.params.id));
    res.json({ message: "Cancelled" });
  }
}

