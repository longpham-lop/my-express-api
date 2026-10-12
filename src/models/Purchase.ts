import {
  DataTypes,
  Model,
  Optional,
} from "sequelize";

import sequelize from "../config/db";

interface PurchaseAttributes {
  id?: number;
  branch_id: number;
  supplier_name: string | null;
  total_amount: number;
  status: string;
  note: string | null;
  created_by: number | null;
}

type PurchaseCreationAttributes = Optional<
  PurchaseAttributes,
  "id"
>;

class Purchase extends Model<
  PurchaseAttributes,
  PurchaseCreationAttributes
> {
  declare id: number;
  declare branch_id: number;
  declare supplier_name: string | null;
  declare total_amount: number;
  declare status: string;
  declare note: string | null;
  declare created_by: number | null;
  declare items?: Array<{
    ingredient_id: number;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
  }>;
}

Purchase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    branch_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    supplier_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "draft",
    },

    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },

  {
    sequelize,
    tableName: "purchases",
    timestamps: true,
  }
);

export default Purchase;