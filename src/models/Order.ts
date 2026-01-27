// models/Order.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import User from "./User";
import Reservation from "./Reservation";

// 1️⃣ Khai báo interface cho các field
export interface OrderAttributes {
  id?: number;
  user_id: number;
  reservation_id?: number | null;
  total_price: number;
  status?: string;
}

// 2️⃣ Tạo class Model chuẩn
class OrderModel extends Model<OrderAttributes> implements OrderAttributes {
  public id!: number;
  public user_id!: number;
  public reservation_id!: number | null;
  public total_price!: number;
  public status!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 3️⃣ Khởi tạo model với init
OrderModel.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    reservation_id: { type: DataTypes.INTEGER, allowNull: true },
    total_price: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
  },
  {
    sequelize,
    tableName: "orders",
    timestamps: true,
  }
);

// 4️⃣ Quan hệ
OrderModel.belongsTo(User, { foreignKey: "user_id" });
OrderModel.belongsTo(Reservation, { foreignKey: "reservation_id" });

export default OrderModel;
