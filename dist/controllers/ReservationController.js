"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateReservationStatus = exports.getReservations = exports.createReservation = void 0;
// Đặt bàn
const createReservation = (req, res) => {
    const { name, phone, date, time, numberOfPeople } = req.body;
    res.json({
        message: "Reservation created",
        data: { name, phone, date, time, numberOfPeople },
    });
};
exports.createReservation = createReservation;
// Danh sách đặt bàn
const getReservations = (req, res) => {
    res.json({
        reservations: [],
    });
};
exports.getReservations = getReservations;
// Cập nhật trạng thái đặt bàn
const updateReservationStatus = (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    res.json({
        message: "Reservation status updated",
        reservationId: id,
        status,
    });
};
exports.updateReservationStatus = updateReservationStatus;
