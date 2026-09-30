import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export type OrderStatus =
  | "pending"
  | "processing"
  | "completed"
  | "cancelled";

export interface OrderAttributes {
  id?: number;
  branch_id?: number | null;
  user_id?: number | null;
  reservation_id?: number | null;
  total_price: number;
  status?: OrderStatus;
  is_deleted?: boolean;
}

type OrderCreationAttributes = Optional<
  OrderAttributes,
  "id" | "branch_id" | "user_id" | "reservation_id" | "status" | "is_deleted"
>;

class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  public id!: number;

  public branch_id?: number | null;

  public user_id?: number | null;

  public reservation_id?: number | null;

  public total_price!: number;

  public status!: OrderStatus;

  public is_deleted!: boolean;

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;
}

Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    branch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    reservation_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    total_price: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "completed",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },

    is_deleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    sequelize,
    tableName: "orders",
    timestamps: true,
  }
);

export default Order;