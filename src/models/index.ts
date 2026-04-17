// src/models/index.ts
import { Sequelize } from 'sequelize';
import User from './User'; // Adjust path as needed
import Role from './Role';// Adjust path as needed
import Menu from './Menu';
import Categories from './Category';
import Order from './Order';
import OrderItem from './OrderItem';

// ... (Your Sequelize instance creation logic) ...
const sequelize = new Sequelize('database', 'username', 'password', {
  host: 'localhost',
  dialect: 'postgres'
});

// Initialize models if you are using the static init() pattern, 
// otherwise just ensure they are imported.

// === DEFINE ASSOCIATIONS HERE ===
// Now that both classes are fully loaded, we can link them safely.

Role.hasMany(User, { 
  foreignKey: 'role_id',
  as: 'users',  
});

User.belongsTo(Role, { 
  foreignKey: 'role_id',
  as: 'role',
});
Order.hasMany(OrderItem, { foreignKey: "order_id", as: "items" });
OrderItem.belongsTo(Order, { foreignKey: "order_id" });

// OrderItem - Menu
OrderItem.belongsTo(Menu, { foreignKey: "menu_item_id", as: "menu" });

// Menu - Category
Categories.hasMany(Menu, { foreignKey: "category_id", as: "menuItems" });
Menu.belongsTo(Categories, { foreignKey: "category_id", as: "category" });
// Menu.belongsTo(Categories, {
//     foreignKey: "category_id",
//     as: "category",
// });

// Categories.hasMany(Menu, {
//     foreignKey: "category_id",
//     as: "items",
// });

// Sync database (optional, depending on where you do this)
// await sequelize.sync({ alter: true });

export { sequelize, User, Role, Menu, Categories, Order, OrderItem };