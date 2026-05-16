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
exports.deleteTable = exports.updateTable = exports.getTableById = exports.updateStatus = exports.getAllTable = exports.createTable = void 0;
const Table_1 = __importDefault(require("../models/Table"));
const Reservation_1 = __importDefault(require("../models/Reservation"));
const createTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, capacity, type } = req.body;
        const table = yield Table_1.default.create({
            name,
            capacity,
            type: (type === null || type === void 0 ? void 0 : type.trim().toLowerCase()) === "vip" ? "vip" : "normal",
            status: "available",
        });
        res.status(201).json(table);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.createTable = createTable;
// GET ALL TABLES
const getAllTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const tables = yield Table_1.default.findAll({
            order: [["id", "ASC"]],
        });
        res.json(tables);
    }
    catch (err) {
        res.status(500).json({
            message: "Server error",
            error: err.message,
        });
    }
});
exports.getAllTable = getAllTable;
// UPDATE TABLE STATUS
const updateStatus = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;
        if (isNaN(id)) {
            return res.status(400).json({
                message: "Invalid table id",
            });
        }
        const validStatus = ["available", "reserved", "occupied"];
        if (!validStatus.includes(status)) {
            return res.status(400).json({
                message: "Invalid table status",
            });
        }
        const [updatedCount, updatedRows] = yield Table_1.default.update({ status }, {
            where: { id },
            returning: true,
        });
        if (updatedCount === 0) {
            return res.status(404).json({
                message: "Table not found",
            });
        }
        res.json({
            message: "Update table status success",
            data: updatedRows[0],
        });
    }
    catch (err) {
        res.status(500).json({
            message: "Server error",
            error: err.message,
        });
    }
});
exports.updateStatus = updateStatus;
/* ===== GET BY ID ===== */
const getTableById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const table = yield Table_1.default.findByPk(id);
        if (!table) {
            return res.status(404).json({ message: "Table not found" });
        }
        res.json(table);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.getTableById = getTableById;
/* ===== UPDATE FULL ===== */
const updateTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const table = yield Table_1.default.findByPk(id);
        if (!table) {
            return res.status(404).json({ message: "Table not found" });
        }
        yield table.update(req.body);
        res.json({
            message: "Update table success",
            data: table,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.updateTable = updateTable;
/* ===== DELETE ===== */
const deleteTable = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const table = yield Table_1.default.findByPk(id);
        if (!table) {
            return res.status(404).json({
                message: "Không tìm thấy bàn",
            });
        }
        // Xóa reservation liên quan
        yield Reservation_1.default.destroy({
            where: {
                table_id: id,
            },
        });
        // Xóa bàn
        yield table.destroy();
        return res.json({
            message: "Xóa bàn thành công",
        });
    }
    catch (err) {
        console.error("DELETE TABLE ERROR:", err);
        return res.status(500).json({
            message: "Lỗi server khi xóa bàn",
        });
    }
});
exports.deleteTable = deleteTable;
