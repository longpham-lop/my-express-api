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
}

// 2️⃣ Khi create thì id là optional
type UserCreationAttributes = Optional<UserAttributes, "id">;

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

  // association
  public Role?: any;

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
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
  }
);
User.belongsTo(Role, {
  foreignKey: "role_id",
});

export default User;
