import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export interface TableAreaAttributes {
  id?: number;
  branch_id: number;
  name: string;
  sort_order?: number;
  is_active?: boolean;
}

type CreationAttributes = Optional<TableAreaAttributes, "id">;

class TableArea extends Model<TableAreaAttributes, CreationAttributes> implements TableAreaAttributes {
  public id!: number;
  public branch_id!: number;
  public name!: string;
  public sort_order!: number;
  public is_active!: boolean;
}

TableArea.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: "table_areas", timestamps: true, indexes: [{ unique: true, fields: ["branch_id", "name"] }] }
);

export default TableArea;
