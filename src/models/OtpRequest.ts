import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export interface OtpRequestAttributes {
  id?: number;
  phone: string;
  purpose: "reservation" | "login";
  code_hash: string;
  expires_at: Date;
  attempts?: number;
  max_attempts?: number;
  verified_at?: Date | null;
  createdAt?: Date;
}

type OtpRequestCreationAttributes = Optional<OtpRequestAttributes, "id">;

class OtpRequest extends Model<OtpRequestAttributes, OtpRequestCreationAttributes> implements OtpRequestAttributes {
  public id!: number;
  public phone!: string;
  public purpose!: "reservation" | "login";
  public code_hash!: string;
  public expires_at!: Date;
  public attempts!: number;
  public max_attempts!: number;
  public verified_at?: Date | null;
  public readonly createdAt!: Date;
}

OtpRequest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    phone: { type: DataTypes.STRING(30), allowNull: false },
    purpose: { type: DataTypes.ENUM("reservation", "login"), allowNull: false },
    code_hash: { type: DataTypes.STRING, allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    verified_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: "otp_requests", timestamps: true, updatedAt: false, indexes: [{ fields: ["phone", "purpose", "createdAt"] }] }
);

export default OtpRequest;
