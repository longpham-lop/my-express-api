// models/MenuItem.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import Category from "./Category";

export interface MenuItemAttributes {
  id?: number;
  name: string;
  price: number;
  categoryId: number;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  image: string;
}

class Menu
  extends Model<MenuItemAttributes>
  implements MenuItemAttributes
{
  public id!: number;
  public name!: string;
  public price!: number;
  public categoryId!: number; 
  public description?: string;
  public image!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Khởi tạo model
Menu.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "category_id", // 👈 nếu DB dùng snake_case
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    image: {
      type: DataTypes.STRING,
    }
  },
  {
    sequelize,
    tableName: "menu_items",
    timestamps: true,
  }
);

// Quan hệ
Menu.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
});

Category.hasMany(Menu, {
  foreignKey: "categoryId",
  as: "menuItems",
});

export default Menu;
