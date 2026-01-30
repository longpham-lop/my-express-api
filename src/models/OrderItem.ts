import { DataTypes } from "sequelize";
import  sequelize  from "../config/db";
import Order from "./Order";
import  MenuItem  from "./MenuItem";

const OrderItem = sequelize.define(
  "OrderItem",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    order_id: { type: DataTypes.INTEGER, allowNull: false },
    menu_item_id: { type: DataTypes.INTEGER, allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false },
    unit_price: { type: DataTypes.FLOAT, allowNull: false },
   
  },
  {
    tableName: "order_items",
    timestamps: true,
  }
);

OrderItem.belongsTo(Order, { foreignKey: "order_id" });
OrderItem.belongsTo(MenuItem, { foreignKey: "menu_item_id" });

export default OrderItem;
