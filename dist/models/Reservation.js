"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
const User_1 = __importDefault(require("./User"));
const Table_1 = __importDefault(require("./Table"));
const Reservation = db_1.default.define("Reservation", {
    id: { type: sequelize_1.DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    table_id: { type: sequelize_1.DataTypes.INTEGER, allowNull: false },
    reservation_time: { type: sequelize_1.DataTypes.DATE, allowNull: false },
    status: { type: sequelize_1.DataTypes.STRING, defaultValue: "pending" },
}, {
    tableName: "reservations",
    timestamps: true,
});
// Quan hệ
Reservation.belongsTo(User_1.default, { foreignKey: "user_id" });
Reservation.belongsTo(Table_1.default, { foreignKey: "table_id" });
exports.default = Reservation;
