import {
  DataTypes,
  Model,
  Optional,
} from "sequelize";

import sequelize from "../config/db";

interface BranchInventoryAttributes {
  id?: number;
  branch_id: number;
  ingredient_id: number;
  quantity: number;
  minimum_stock: number;
}

type BranchInventoryCreationAttributes = Optional<
  BranchInventoryAttributes,
  "id"
>;

class BranchInventory extends Model<
  BranchInventoryAttributes,
  BranchInventoryCreationAttributes
> {
  declare id: number;
  declare branch_id: number;
  declare ingredient_id: number;
  declare quantity: number;
  declare minimum_stock: number;
}

BranchInventory.init(
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

    quantity: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },

    minimum_stock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
      },
    },
  },
  {
    sequelize,
    tableName: "branch_inventory",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["branch_id", "ingredient_id"],
      },
    ],
  }
);

export default BranchInventory;