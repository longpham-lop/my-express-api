import { DataTypes } from "sequelize";
import sequelize from "../config/db";
import User from "./User";
import Table from "./Table"; 

const Reservation = sequelize.define(
  "Reservation",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    table_id: { type: DataTypes.INTEGER, allowNull: false },
    reservation_time: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
  },
  {
    tableName: "reservations",
    timestamps: true,
  }
);

// Quan hệ
Reservation.belongsTo(User, { foreignKey: "user_id" });
Reservation.belongsTo(Table, { foreignKey: "table_id" });

export default Reservation;
