import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";
import Category from "./Category"; // import bình thường, Category đã là Model

export interface MenuItemAttributes {
  id?: number;
  name: string;
  price: number;
  categoryId: number;
  description?: string;
  image: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class Menu extends Model<MenuItemAttributes> implements MenuItemAttributes {
  public id!: number;
  public name!: string;
  public price!: number;
  public categoryId!: number;
  public description?: string;
  public image!: string;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Khởi tạo model
Menu.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.FLOAT, allowNull: false },
    categoryId: { type: DataTypes.INTEGER, allowNull: false, field: "category_id" },
    description: { type: DataTypes.STRING, allowNull: true },
    image: { type: DataTypes.TEXT, allowNull: true },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    sequelize,
    tableName: "menu_items",
    timestamps: true,
  }
);

// ⚡ Thiết lập quan hệ SAU khi cả 2 model đã init
Category.hasMany(Menu, { foreignKey: "categoryId", as: "menuItems" });
Menu.belongsTo(Category, { foreignKey: "categoryId", as: "category" });

export default Menu;