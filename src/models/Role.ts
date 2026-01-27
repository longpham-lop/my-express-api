import { DataTypes } from "sequelize";
import sequelize from "../config/db";

const Role = sequelize.define(
  "Role",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  {
    tableName: "roles",
    timestamps: false,
  }
);

export default Role;
