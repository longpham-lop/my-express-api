import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";

export interface CustomerAttributes {
  id?: number;
  phone: string;
  name: string;
  email?: string | null;
  birth_date?: Date | null;
  notification_opt_in?: boolean;
}

type CustomerCreationAttributes = Optional<CustomerAttributes, "id">;

class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  public id!: number;
  public phone!: string;
  public name!: string;
  public email?: string | null;
  public birth_date?: Date | null;
  public notification_opt_in!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Customer.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    phone: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    name: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: true },
    birth_date: { type: DataTypes.DATEONLY, allowNull: true },
    notification_opt_in: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: "customers", timestamps: true }
);

export default Customer;
