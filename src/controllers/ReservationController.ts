import type { Request, Response } from "express";

// Đặt bàn
export const createReservation = (req: Request, res: Response) => {
  const { name, phone, date, time, numberOfPeople } = req.body;

  res.json({
    message: "Reservation created",
    data: { name, phone, date, time, numberOfPeople },
  });
};

// Danh sách đặt bàn
export const getReservations = (req: Request, res: Response) => {
  res.json({
    reservations: [],
  });
};

// Cập nhật trạng thái đặt bàn
export const updateReservationStatus = (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  res.json({
    message: "Reservation status updated",
    reservationId: id,
    status,
  });
};
