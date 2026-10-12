import {
  DataTypes,
  Model,
  Optional,
} from "sequelize";

import sequelize from "../config/db";

interface RecipeItemAttributes {
  id?: number;
  menu_item_id: number;
  ingredient_id: number;
  quantity: number;
  unit: string;
}

type RecipeItemCreationAttributes = Optional<
  RecipeItemAttributes,
  "id"
>;

class RecipeItem extends Model<
  RecipeItemAttributes,
  RecipeItemCreationAttributes
> {
  declare id: number;
  declare menu_item_id: number;
  declare ingredient_id: number;
  declare quantity: number;
  declare unit: string;
}

RecipeItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    menu_item_id: {
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
  },
  {
    sequelize,
    tableName: "recipe_items",
    timestamps: true,
  }
);

export default RecipeItem;