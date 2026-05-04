import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";
import User from "./User";
import Table from "./Table";

// Interface định nghĩa các field
export interface ReservationAttributes {
  id: number;
  user_id?: number;
  table_id: number;
  reservation_time: Date;
  status: string;
  customer_name?: string; // thêm tên khách hàng
  phone?: string; // thêm số điện thoại
  branch?: string; // thêm chi nhánh
  note?: string; // thêm ghi chú
}

// id là optional khi tạo
type ReservationCreationAttributes = Optional<ReservationAttributes, "id">;

class Reservation
  extends Model<ReservationAttributes, ReservationCreationAttributes>
  implements ReservationAttributes
{
  public id!: number;
  public user_id?: number;
  public table_id!: number;
  public reservation_time!: Date;
  public status!: string;
  public customer_name?: string;
  public phone?: string;
  public branch?: string;
  public note?: string;
}

Reservation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    table_id: { type: DataTypes.INTEGER, allowNull: false },
    reservation_time: { type: DataTypes.DATE, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
    customer_name: { type: DataTypes.STRING, allowNull: false }, // thêm tên khách hàng
    phone: { type: DataTypes.STRING, allowNull: true }, // thêm số điện thoại
    branch: { type: DataTypes.STRING, allowNull: true }, // thêm chi nhánh
    note: { type: DataTypes.TEXT, allowNull: true }, // thêm ghi chú
  },
  {
    sequelize,
    tableName: "reservations",
    timestamps: true,
  }
);

// Quan hệ
Reservation.belongsTo(User, { foreignKey: "user_id" });
Reservation.belongsTo(Table, { foreignKey: "table_id" });

export default Reservation;