import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export type OrderItemStatus =
  | "pending"
  | "cooking"
  | "ready"
  | "served"
  | "cancelled";
export interface OrderItemAttributes {
  id?: number;
  order_id: number;
  menu_item_id: number;
  quantity: number;
  unit_price: number;
  status?: OrderItemStatus; 
}

type OrderItemCreationAttributes = Optional<
  OrderItemAttributes,
  "id"
>;

class OrderItem
  extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes
{
  public id!: number;

  public order_id!: number;

  public menu_item_id!: number;

  public quantity!: number;

  public unit_price!: number;
  
  public status!: OrderItemStatus;

  public readonly createdAt!: Date;

  public readonly updatedAt!: Date;
}

OrderItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    menu_item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    unit_price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "cooking",
        "ready",
        "served",
        "cancelled"
      ),
      allowNull: true,
      defaultValue: "pending",
    }
  },
  {
    sequelize,
    tableName: "order_items",
    timestamps: true,
  }
);

export default OrderItem;