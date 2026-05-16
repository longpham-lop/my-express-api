"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/Order.ts
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
const User_1 = __importDefault(require("./User"));
const Reservation_1 = __importDefault(require("./Reservation"));
// 2️⃣ Tạo class Model chuẩn
class Order extends sequelize_1.Model {
}
// 3️⃣ Khởi tạo model với init
Order.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
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
Order.belongsTo(User_1.default, { foreignKey: "user_id" });
Order.belongsTo(Reservation_1.default, { foreignKey: "reservation_id" });
// OrderModel.hasMany(OrderItem, {foreignKey: "order_id", as: "items",});
exports.default = Order;
