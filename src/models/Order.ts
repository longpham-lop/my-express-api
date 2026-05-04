// models/Order.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import User from "./User";
import Reservation from "./Reservation";
import OrderItem from "./OrderItem";

// 1️⃣ Khai báo interface cho các field
export interface OrderAttributes {
  id?: number;
  user_id?: number;
  reservation_id?: number | null;
  total_price: number;
  status?: string;
  is_deleted?: boolean;
}

// 2️⃣ Tạo class Model chuẩn
class Order extends Model<OrderAttributes> implements OrderAttributes {
  public id!: number;
  public user_id!: number;
  public reservation_id!: number | null;
  public total_price!: number;
  public status!: string;
  public is_deleted!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 3️⃣ Khởi tạo model với init
Order.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    reservation_id: { type: DataTypes.INTEGER, allowNull: true },
    total_price: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
    is_deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    sequelize,
    tableName: "orders",
    timestamps: true,
  }
);

// 4️⃣ Quan hệ
Order.belongsTo(User, { foreignKey: "user_id" });
Order.belongsTo(Reservation, { foreignKey: "reservation_id" });
// OrderModel.hasMany(OrderItem, {foreignKey: "order_id", as: "items",});

export default Order;
