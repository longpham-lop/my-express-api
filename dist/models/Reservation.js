"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
const User_1 = __importDefault(require("./User"));
const Table_1 = __importDefault(require("./Table"));
class Reservation extends sequelize_1.Model {
}
Reservation.init({
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: true },
    table_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reservation_time: { type: sequelize_1.DataTypes.DATE, allowNull: false },
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
Reservation.belongsTo(User_1.default, { foreignKey: "user_id" });
Reservation.belongsTo(Table_1.default, { foreignKey: "table_id" });
exports.default = Reservation;
