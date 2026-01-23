"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteMenuItem = exports.updateMenuItem = exports.createMenuItem = exports.getMenuItemById = exports.getMenu = void 0;
// Lấy danh sách món
const getMenu = (req, res) => {
    res.json({
        menu: [
            {
                id: 1,
                name: "Cơm gà",
                price: 45000,
                category: "Món chính",
                status: "available",
            },
            {
                id: 2,
                name: "Trà đào",
                price: 25000,
                category: "Đồ uống",
                status: "available",
            },
        ],
    });
};
exports.getMenu = getMenu;
// Lấy chi tiết món
const getMenuItemById = (req, res) => {
    const { id } = req.params;
    res.json({
        id,
        name: "Cơm gà",
        price: 45000,
        category: "Món chính",
        description: "Cơm gà xối mỡ",
    });
};
exports.getMenuItemById = getMenuItemById;
// Thêm món
const createMenuItem = (req, res) => {
    console.log(req.body);
    const { name, price, category, description } = req.body;
    res.json({
        message: "Menu item created",
        data: { name, price, category, description },
    });
};
exports.createMenuItem = createMenuItem;
// Cập nhật món
const updateMenuItem = (req, res) => {
    const { id } = req.params;
    const { name, price, category, description } = req.body;
    res.json({
        message: "Menu item updated",
        id,
        data: { name, price, category, description },
    });
};
exports.updateMenuItem = updateMenuItem;
// Xóa món
const deleteMenuItem = (req, res) => {
    const { id } = req.params;
    res.json({
        message: "Menu item deleted",
        id,
    });
};
exports.deleteMenuItem = deleteMenuItem;
