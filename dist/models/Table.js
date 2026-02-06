"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/Table.ts
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
class Table extends sequelize_1.Model {
}
Table.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "available",
    },
}, {
    sequelize: db_1.default,
    tableName: "tables",
    timestamps: true,
});
exports.default = Table;
