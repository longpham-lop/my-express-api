import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

// Interface định nghĩa các field
export interface ReservationAttributes {
  id: number;
  branch_id?: number | null;
  user_id?: number;
  table_id: number;
  reservation_time: Date;
  end_time?: Date | null;
  source?: "online" | "phone" | "walk_in";
  status: string;
  customer_name?: string; 
  phone?: string; 
  email?: string;
  branch?: string; 
  note?: string; 
  guest_count: number;

}

// id là optional khi tạo
type ReservationCreationAttributes = Optional<ReservationAttributes, "id">;

class Reservation
  extends Model<ReservationAttributes, ReservationCreationAttributes>
  implements ReservationAttributes
{
  public id!: number;
  public branch_id?: number | null;
  public user_id?: number;
  public table_id!: number;
  public reservation_time!: Date;
  public end_time?: Date | null;
  public source!: "online" | "phone" | "walk_in";
  public status!: string;
  public customer_name?: string;
  public phone?: string;
  public email?: string;
  public branch?: string;
  public note?: string;
  public guest_count!: number;
}

Reservation.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    table_id: { type: DataTypes.INTEGER, allowNull: false },
    reservation_time: { type: DataTypes.DATE, allowNull: false },
    end_time: { type: DataTypes.DATE, allowNull: true },
    source: { type: DataTypes.ENUM("online", "phone", "walk_in"), allowNull: false, defaultValue: "online" },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
    customer_name: { type: DataTypes.STRING, allowNull: false }, 
    phone: { type: DataTypes.STRING, allowNull: true }, 
    email: {type: DataTypes.STRING, allowNull: true},
    branch: { type: DataTypes.STRING, allowNull: true }, 
    note: { type: DataTypes.TEXT, allowNull: true }, 
    guest_count: { type: DataTypes.INTEGER, allowNull: true},
  },
  {
    sequelize,
    tableName: "reservations",
    timestamps: true,
  }
);

// Quan hệ

export default Reservation;
