// models/Table.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";

// 1️⃣ Interface
export interface TableAttributes {
  id?: number;
  name: string;
  capacity: number;
  status?: string;
  type?: "normal" | "vip";
}

// 2️⃣ Model class
class TableModel extends Model<TableAttributes> implements TableAttributes {
  public id!: number;
  public name!: string;
  public capacity!: number;
  public status!: string;
  public type!: "normal" | "vip";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 3️⃣ Init model
TableModel.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "available",
    },
    type: {
      type: DataTypes.ENUM("normal", "vip"),
      defaultValue: "normal",
    }
  },
  {
    sequelize,
    tableName: "tables",
    timestamps: true,
  }
);

export default TableModel;