"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllReservationsAdmin = exports.getAllReservations = exports.createReservation = void 0;
const Reservation_1 = __importDefault(require("../models/Reservation"));
const Table_1 = __importDefault(require("../models/Table"));
/* ================= CREATE RESERVATION ================= */
const createReservation = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const { table_id, reservation_time } = req.body;
        if (!table_id || !reservation_time) {
            return res.status(400).json({ message: "Thiếu dữ liệu" });
        }
        // kiểm tra bàn
        const table = yield Table_1.default.findByPk(table_id);
        if (!table) {
            return res.status(400).json({ message: "Table không tồn tại" });
        }
        if (table.status !== "available") {
            return res.status(400).json({ message: "Bàn đã được đặt" });
        }
        // tạo reservation
        const reservation = yield Reservation_1.default.create({
            user_id: req.user.id, // ✅ từ JWT
            table_id,
            reservation_time,
            status: "pending",
        });
        // cập nhật trạng thái bàn
        yield table.update({ status: "reserved" });
        res.status(201).json(reservation);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createReservation = createReservation;
/* ================= GET ALL RESERVATIONS (THEO USER) ================= */
const getAllReservations = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const data = yield Reservation_1.default.findAll({
            where: { user_id: req.user.id },
        });
        res.json(data);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getAllReservations = getAllReservations;
const getAllReservationsAdmin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield Reservation_1.default.findAll();
    res.json(data);
});
exports.getAllReservationsAdmin = getAllReservationsAdmin;
