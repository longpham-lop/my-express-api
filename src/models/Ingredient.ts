import {
  DataTypes,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
  Model,
} from "sequelize";

import sequelize from "../config/db";

class Ingredient extends Model<
  InferAttributes<Ingredient>,
  InferCreationAttributes<Ingredient>
> {
  declare id: CreationOptional<number>;

  declare name: string;

  declare unit: string;

  declare category: string | null;

  declare minimum_stock: CreationOptional<number>;

  declare status: CreationOptional<"active" | "inactive">;
}

Ingredient.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
    },

    minimum_stock: {
      type: DataTypes.DECIMAL(12, 3),
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize,
    tableName: "ingredients",
    timestamps: true,
  }
);

export default Ingredient;