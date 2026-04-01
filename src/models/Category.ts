// models/Category.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";

// 1️⃣ Khai báo interface cho các field
export interface CategoryAttributes {
  id?: number;
  name: string;
}

// 2️⃣ Tạo class Model chuẩn
class CategoryModel
  extends Model<CategoryAttributes>
  implements CategoryAttributes
{
  public id!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 3️⃣ Khởi tạo model với init
CategoryModel.init(
  {
    id: { 
      type: DataTypes.INTEGER, 
      primaryKey: true, 
      autoIncrement: true 
    },

    name: { 
      type: DataTypes.STRING, 
      allowNull: false, 
      unique: true 
    },
  },
  {
    sequelize,
    tableName: "categories",
    timestamps: true,
  }
);

export default CategoryModel;