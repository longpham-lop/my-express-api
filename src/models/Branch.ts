import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export interface BranchAttributes {
  id?: number;
  code: string;
  name: string;
  address: string;
  phone?: string;
  opening_time: string;
  closing_time: string;
  is_accepting_reservations?: boolean;
  status?: "active" | "inactive";
}

type BranchCreationAttributes = Optional<BranchAttributes, "id">;

class Branch extends Model<BranchAttributes, BranchCreationAttributes> implements BranchAttributes {
  public id!: number;
  public code!: string;
  public name!: string;
  public address!: string;
  public phone?: string;
  public opening_time!: string;
  public closing_time!: string;
  public is_accepting_reservations!: boolean;
  public status!: "active" | "inactive";
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Branch.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    code: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    address: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    opening_time: { type: DataTypes.TIME, allowNull: false, defaultValue: "09:00:00" },
    closing_time: { type: DataTypes.TIME, allowNull: false, defaultValue: "22:00:00" },
    is_accepting_reservations: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    status: { type: DataTypes.ENUM("active", "inactive"), allowNull: false, defaultValue: "active" },
  },
  { sequelize, tableName: "branches", timestamps: true }
);

export default Branch;
