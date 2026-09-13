import sequelize from "../config/db";
import User from "./User";
import Role from "./Role";
import Menu from "./Menu";
import Category from "./Category";
import Order from "./Order";
import OrderItem from "./OrderItem";
import Table from "./Table";
import Reservation from "./Reservation";
import Payment from "./Payment";
import Branch from "./Branch";
import BranchSetting from "./BranchSetting";
import TableArea from "./TableArea";
import StaffBranch from "./StaffBranch";
import Customer from "./Customer";
import OtpRequest from "./OtpRequest";

Role.hasMany(User, { foreignKey: "role_id", as: "users" });
User.belongsTo(Role, { foreignKey: "role_id", as: "role" });
User.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });

Branch.hasOne(BranchSetting, { foreignKey: "branch_id", as: "settings", onDelete: "CASCADE" });
BranchSetting.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });
Branch.hasMany(TableArea, { foreignKey: "branch_id", as: "areas" });
TableArea.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });
Branch.hasMany(Table, { foreignKey: "branch_id", as: "tables" });
Table.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });
TableArea.hasMany(Table, { foreignKey: "area_id", as: "tables" });
Table.belongsTo(TableArea, { foreignKey: "area_id", as: "area" });
Branch.hasMany(Menu, { foreignKey: "branch_id", as: "menuItems" });
Menu.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });
Branch.hasMany(Category, { foreignKey: "branch_id", as: "categories" });
Category.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });
Branch.hasMany(Reservation, { foreignKey: "branch_id", as: "reservations" });
// Reservation cũ đã có cột `branch` dạng text; dùng alias khác để không va chạm.
Reservation.belongsTo(Branch, { foreignKey: "branch_id", as: "restaurantBranch" });
Customer.hasMany(Reservation, { foreignKey: "customer_id", as: "reservations" });
Reservation.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });
Branch.hasMany(Order, { foreignKey: "branch_id", as: "orders" });
Order.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });
User.belongsToMany(Branch, { through: StaffBranch, foreignKey: "user_id", as: "branches" });
Branch.belongsToMany(User, { through: StaffBranch, foreignKey: "branch_id", as: "staff" });
StaffBranch.belongsTo(User, { foreignKey: "user_id", as: "user" });
StaffBranch.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });

Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "order_id" });
OrderItem.belongsTo(Menu, { foreignKey: "menu_item_id", as: "menu" });
Category.hasMany(Menu, { foreignKey: "category_id", as: "menuItems" });
Menu.belongsTo(Category, { foreignKey: "category_id", as: "category" });
Reservation.belongsTo(User, { foreignKey: "user_id" });
Reservation.belongsTo(Table, { foreignKey: "table_id" });
Order.belongsTo(User, { foreignKey: "user_id" });
Order.belongsTo(Reservation, { foreignKey: "reservation_id" });
Payment.belongsTo(Order, { foreignKey: "order_id" });

export { sequelize, User, Role, Menu, Category, Order, OrderItem, Table, Reservation, Payment, Branch, BranchSetting, TableArea, StaffBranch, Customer, OtpRequest };
