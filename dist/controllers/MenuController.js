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
exports.MenuController = void 0;
const MenuItem_1 = __importDefault(require("../models/MenuItem"));
const Category_1 = __importDefault(require("../models/Category"));
class MenuController {
    // CREATE
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { name, price, categoryId, description, image } = req.body;
                if (!name || !price || !categoryId) {
                    return res.status(400).json({
                        message: "name, price, categoryId are required",
                    });
                }
                // check category tồn tại
                const category = yield Category_1.default.findByPk(categoryId);
                if (!category) {
                    return res.status(404).json({ message: "Category not found" });
                }
                const item = yield MenuItem_1.default.create({
                    name,
                    price,
                    categoryId,
                    description,
                    image,
                });
                return res.status(201).json({
                    message: "Menu item created successfully",
                    data: item,
                });
            }
            catch (err) {
                return res.status(500).json({ message: err.message });
            }
        });
    }
    // GET ALL
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const items = yield MenuItem_1.default.findAll({
                    include: [{ model: Category_1.default, attributes: ["id", "name"] }],
                    order: [["id", "DESC"]],
                });
                return res.json(items);
            }
            catch (err) {
                return res.status(500).json({ message: err.message });
            }
        });
    }
    // GET BY ID
    static getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const item = yield MenuItem_1.default.findByPk(id, {
                    include: Category_1.default,
                });
                if (!item) {
                    return res.status(404).json({ message: "Menu item not found" });
                }
                return res.json(item);
            }
            catch (err) {
                return res.status(500).json({ message: err.message });
            }
        });
    }
    // UPDATE
    static update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const item = yield MenuItem_1.default.findByPk(id);
                if (!item) {
                    return res.status(404).json({ message: "Menu item not found" });
                }
                yield item.update(req.body);
                return res.json({
                    message: "Menu item updated successfully",
                    data: item,
                });
            }
            catch (err) {
                return res.status(500).json({ message: err.message });
            }
        });
    }
    // DELETE
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const id = Number(req.params.id);
                const item = yield MenuItem_1.default.findByPk(id);
                if (!item) {
                    return res.status(404).json({ message: "Menu item not found" });
                }
                yield item.destroy();
                return res.json({ message: "Menu item deleted successfully" });
            }
            catch (err) {
                return res.status(500).json({ message: err.message });
            }
        });
    }
}
exports.MenuController = MenuController;
