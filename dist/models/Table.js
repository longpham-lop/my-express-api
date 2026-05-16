"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/Table.ts
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
// 2️⃣ Model class
class TableModel extends sequelize_1.Model {
}
// 3️⃣ Init model
TableModel.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    capacity: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
    },
    status: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        defaultValue: "available",
    },
    type: {
        type: sequelize_1.DataTypes.ENUM("normal", "vip"),
        defaultValue: "normal",
    }
}, {
    sequelize: db_1.default,
    tableName: "tables",
    timestamps: true,
});
exports.default = TableModel;
