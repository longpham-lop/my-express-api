// models/User.ts
import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";
import Role from "./Role";

// 1️⃣ Khai báo attributes
export interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  role_id: number;
  phone?: string | null;
  branch_id?: number | null;
  status: "active" | "inactive";
}

// 2️⃣ Khi create thì id và status là optional vì status có defaultValue
type UserCreationAttributes = Optional<UserAttributes, "id" | "status">;

// 3️⃣ Class User
class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public role_id!: number;
  public phone?: string | null;
  public branch_id?: number | null;
  public status!: "active" | "inactive";

  // association
  public role?: Role;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

// 4️⃣ Init
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    phone: { type: DataTypes.STRING(30), 
      allowNull: true, 
      unique: true 
    },
    branch_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
  }
);
   

export default User;
