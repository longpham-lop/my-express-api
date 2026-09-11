import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export interface StaffBranchAttributes {
  id?: number;
  user_id: number;
  branch_id: number;
  is_primary?: boolean;
  is_active?: boolean;
}

type CreationAttributes = Optional<StaffBranchAttributes, "id">;

class StaffBranch extends Model<StaffBranchAttributes, CreationAttributes> implements StaffBranchAttributes {
  public id!: number;
  public user_id!: number;
  public branch_id!: number;
  public is_primary!: boolean;
  public is_active!: boolean;
}

StaffBranch.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    branch_id: { type: DataTypes.INTEGER, allowNull: false },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: "staff_branches", timestamps: true, indexes: [{ unique: true, fields: ["user_id", "branch_id"] }] }
);

export default StaffBranch;
