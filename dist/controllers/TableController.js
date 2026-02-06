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
exports.TableController = void 0;
const Table_1 = __importDefault(require("../models/Table"));
class TableController {
    // Lấy tất cả bảng
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const tables = yield Table_1.default.findAll(); // dùng Sequelize chuẩn
                res.json(tables);
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    }
    // Cập nhật status bảng
    static updateStatus(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const { status } = req.body;
                // Cách 1: dùng update chuẩn Sequelize
                const [updatedCount, updatedRows] = yield Table_1.default.update({ status }, { where: { id }, returning: true } // returning: true để lấy bản ghi sau update
                );
                if (updatedCount === 0) {
                    return res.status(404).json({ message: "Table not found" });
                }
                res.json(updatedRows[0]); // trả về bảng đã update
            }
            catch (err) {
                res.status(500).json({ error: err.message });
            }
        });
    }
}
exports.TableController = TableController;
