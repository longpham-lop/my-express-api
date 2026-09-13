"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/Order.ts
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
// 2️⃣ Tạo class Model chuẩn
class Order extends sequelize_1.Model {
}
// 3️⃣ Khởi tạo model với init
Order.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    branch_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    user_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    reservation_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    total_price: { type: sequelize_1.DataTypes.FLOAT, allowNull: false },
    status: { type: sequelize_1.DataTypes.STRING, defaultValue: "pending" },
    is_deleted: { type: sequelize_1.DataTypes.BOOLEAN, defaultValue: false },
}, {
    sequelize: db_1.default,
    tableName: "orders",
    timestamps: true,
});
// 4️⃣ Quan hệ
// OrderModel.hasMany(OrderItem, {foreignKey: "order_id", as: "items",});
exports.default = Order;
