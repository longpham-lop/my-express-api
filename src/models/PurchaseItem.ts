import {
  DataTypes,
  Model,
  Optional,
} from "sequelize";

import sequelize from "../config/db";

interface PurchaseItemAttributes {
  id?: number;
  purchase_id: number;
  ingredient_id: number;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

type PurchaseItemCreationAttributes = Optional<
  PurchaseItemAttributes,
  "id"
>;

class PurchaseItem extends Model<
  PurchaseItemAttributes,
  PurchaseItemCreationAttributes
> {
  declare id: number;
  declare purchase_id: number;
  declare ingredient_id: number;

  declare quantity: number;
  declare unit: string;

  declare unit_price: number;
  declare total_price: number;
}

PurchaseItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    purchase_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    ingredient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
    },

    unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },

    total_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },

  {
    sequelize,
    tableName: "purchase_items",
    timestamps: true,
  }
);

export default PurchaseItem;