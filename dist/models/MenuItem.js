"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/MenuItem.ts
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
const Category_1 = __importDefault(require("./Category"));
class MenuItem extends sequelize_1.Model {
}
// Khởi tạo model
MenuItem.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    price: {
        type: sequelize_1.DataTypes.FLOAT,
        allowNull: false,
    },
    categoryId: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        field: "category_id", // 👈 nếu DB dùng snake_case
    },
    description: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: true,
    },
    image: {
        type: sequelize_1.DataTypes.STRING,
    }
}, {
    sequelize: db_1.default,
    tableName: "menu_items",
    timestamps: true,
});
// Quan hệ
MenuItem.belongsTo(Category_1.default, {
    foreignKey: "categoryId",
    as: "category",
});
Category_1.default.hasMany(MenuItem, {
    foreignKey: "categoryId",
    as: "menuItems",
});
exports.default = MenuItem;
