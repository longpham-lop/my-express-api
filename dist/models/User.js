"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/User.ts
const sequelize_1 = require("sequelize");
const db_1 = __importDefault(require("../config/db"));
const Role_1 = __importDefault(require("./Role"));
// 3️⃣ Class User
class User extends sequelize_1.Model {
}
// 4️⃣ Init
User.init({
    id: {
        type: sequelize_1.DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    name: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    email: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: sequelize_1.DataTypes.STRING,
        allowNull: false,
    },
    role_id: {
        type: sequelize_1.DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
    },
}, {
    sequelize: db_1.default,
    tableName: "users",
    timestamps: true,
});
User.belongsTo(Role_1.default, {
    foreignKey: "role_id",
});
exports.default = User;
