import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Model,
} from "sequelize";

import sequelize from "../config/db";

class InventoryTransaction extends Model<
  InferAttributes<InventoryTransaction>,
  InferCreationAttributes<InventoryTransaction>
> {
  declare id: CreationOptional<number>;

  declare branch_id: number;
  declare ingredient_id: number;
  declare type: string;
  declare quantity: number;
  declare unit: string;

  declare reference_type: string | null;
  declare reference_id: number | null;
  declare note: string | null;
  declare created_by: number | null;

}

InventoryTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    branch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    ingredient_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    type: {
      type: DataTypes.STRING(30),
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

    reference_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "inventory_transactions",
    timestamps: true,
  }
);

export default InventoryTransaction;