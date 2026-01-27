// models/Table.ts
import { DataTypes, Model } from "sequelize";
import sequelize from "../config/db";

class Table extends Model {
  public id!: number;
  public status!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Table.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "available",
    },
  },
  {
    sequelize,
    tableName: "tables",
    timestamps: true,
  }
);

export default Table;
