import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export interface BranchSettingAttributes {
  id?: number;
  branch_id: number;
  default_table_duration_minutes?: number;
  reservation_interval_minutes?: number;
  reservation_lead_time_minutes?: number;
}

type CreationAttributes = Optional<BranchSettingAttributes, "id">;

class BranchSetting extends Model<BranchSettingAttributes, CreationAttributes> implements BranchSettingAttributes {
  public id!: number;
  public branch_id!: number;
  public default_table_duration_minutes!: number;
  public reservation_interval_minutes!: number;
  public reservation_lead_time_minutes!: number;
}

BranchSetting.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    branch_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
    default_table_duration_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 120 },
    reservation_interval_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
    reservation_lead_time_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 30 },
  },
  { sequelize, tableName: "branch_settings", timestamps: true }
);

export default BranchSetting;
