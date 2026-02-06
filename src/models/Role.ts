import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../config/db";
import User from "./User";


export interface RoleAttributes {
  id: number;
  name: string; // admin | user
}

type RoleCreationAttributes = Optional<RoleAttributes, "id">;

class Role
  extends Model<RoleAttributes, RoleCreationAttributes>
  implements RoleAttributes
{
  public id!: number;
  public name!: string;
}

Role.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    tableName: "roles",
    timestamps: false,
  }
);
// Role.hasMany(User,{
//   foreignKey:"id"
// })
export default Role;
