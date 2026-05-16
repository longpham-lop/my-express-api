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
exports.deleteMenuItem = exports.updateMenuItem = exports.getMenuItemById = exports.getAllMenuItems = exports.createMenuItem = void 0;
const Menu_1 = __importDefault(require("../models/Menu"));
const Category_1 = __importDefault(require("../models/Category"));
/* ================= CREATE ================= */
const createMenuItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, price, category_id, description, image } = req.body;
        if (!name || !price || !category_id) {
            return res.status(400).json({
                message: "name, price, category_id are required",
            });
        }
        const category = yield Category_1.default.findByPk(category_id);
        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }
        console.log(req.body);
        const item = yield Menu_1.default.create({
            name,
            price,
            category_id,
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
exports.createMenuItem = createMenuItem;
/* ================= GET ALL ================= */
const getAllMenuItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const items = yield Menu_1.default.findAll({
            where: { is_deleted: false },
            include: [
                {
                    model: Category_1.default,
                    as: "category",
                    attributes: ["id", "name"],
                },
            ],
            order: [["id", "DESC"]],
        });
        return res.json({
            message: "Get all menu items success",
            data: items,
        });
    }
    catch (err) {
        return res.status(500).json({ message: err.message });
    }
});
exports.getAllMenuItems = getAllMenuItems;
/* ================= GET BY ID ================= */
const getMenuItemById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const item = yield Menu_1.default.findByPk(id, {
            include: [
                {
                    model: Category_1.default,
                },
            ],
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
exports.getMenuItemById = getMenuItemById;
/* ================= UPDATE ================= */
const updateMenuItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const item = yield Menu_1.default.findByPk(id);
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
exports.updateMenuItem = updateMenuItem;
/* ================= DELETE ================= */
const deleteMenuItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const id = Number(req.params.id);
        const item = yield Menu_1.default.findByPk(id);
        if (!item) {
            return res.status(404).json({ message: "Menu item not found" });
        }
        yield item.update({ is_deleted: true });
        return res.json({
            message: "Menu item deleted successfully",
        });
    }
    catch (err) {
        if (err.name === "SequelizeForeignKeyConstraintError") {
            return res.status(400).json({
                message: "Không thể xóa vì món ăn đã tồn tại trong đơn hàng!",
            });
        }
        return res.status(500).json({ message: err.message });
    }
});
exports.deleteMenuItem = deleteMenuItem;
