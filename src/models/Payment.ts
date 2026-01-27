// models/Payment.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import Order from "./Order";

// 1️⃣ Interface cho field
export interface PaymentAttributes {
  id?: number;
  order_id: number;
  method: string;
  amount: number;
  status?: string;
}

// 2️⃣ Class model chuẩn TS
class PaymentModel extends Model<PaymentAttributes> implements PaymentAttributes {
  public id!: number;
  public order_id!: number;
  public method!: string;
  public status!: string;
  public amount!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 3️⃣ Khởi tạo model
PaymentModel.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    method: { type: DataTypes.STRING, allowNull: false },
     amount: { type: DataTypes.FLOAT, allowNull: false },
    status: { type: DataTypes.STRING, defaultValue: "pending" },
  },
  {
    sequelize,
    tableName: "payments",
    timestamps: true,
  }
);

// 4️⃣ Quan hệ
PaymentModel.belongsTo(Order, { foreignKey: "order_id" });

export default PaymentModel;
