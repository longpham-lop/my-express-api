"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
class Reservation extends sequelize_1.Model {
}
Reservation.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    branch_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    customer_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    reservation_code: { type: sequelize_1.DataTypes.STRING(24), allowNull: true, unique: true },
    user_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    table_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reservation_time: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    end_time: { type: sequelize_1.DataTypes.DATE, allowNull: true },
    source: { type: sequelize_1.DataTypes.ENUM("online", "phone", "walk_in"), allowNull: false, defaultValue: "online" },
    status: { type: sequelize_1.DataTypes.STRING, defaultValue: "pending" },
    customer_name: { type: sequelize_1.DataTypes.STRING, allowNull: false },
    phone: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    email: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    branch: { type: sequelize_1.DataTypes.STRING, allowNull: true },
    note: { type: sequelize_1.DataTypes.TEXT, allowNull: true },
    guest_count: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
}, {
    sequelize: db_1.default,
    tableName: "reservations",
    timestamps: true,
});
// Quan hệ
exports.default = Reservation;
