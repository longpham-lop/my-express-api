import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";

export interface CategoryAttributes {
  id?: number;
  branch_id?: number | null;
  name: string;
}

class Category extends Model<CategoryAttributes> implements CategoryAttributes {
  public id!: number;
  public branch_id?: number | null;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// Khởi tạo model
Category.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  {
    sequelize,
    tableName: "categories",
    timestamps: true,
    indexes: [{ unique: true, fields: ["branch_id", "name"] }],
  }
);

export default Category;
