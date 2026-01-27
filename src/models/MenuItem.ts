// models/MenuItem.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db"; // import default đúng

export interface MenuItemAttributes {
  id?: number;
  name: string;
  price: number;
  description?: string;
}

class MenuItem extends Model<MenuItemAttributes> implements MenuItemAttributes {
  public id!: number;
  public name!: string;
  public price!: number;
  public description?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Khởi tạo model
MenuItem.init(
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
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize, // ✅ bắt buộc phải có
    tableName: "menu_items",
    timestamps: true,
  }
);

export default MenuItem;
