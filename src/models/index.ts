// src/models/index.ts
import { Sequelize } from 'sequelize';
import User from './User'; // Adjust path as needed
import Role from './Role';// Adjust path as needed
import Menu from './Menu';
import Categories from './Category';

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
  foreignKey: 'role_id' 
});

User.belongsTo(Role, { 
  foreignKey: 'role_id' 
});

Menu.belongsTo(Categories, {
    foreignKey: "category_id",
    as: "category",
});

Categories.hasMany(Menu, {
    foreignKey: "category_id",
    as: "items",
});

// Sync database (optional, depending on where you do this)
// await sequelize.sync({ alter: true });

export { sequelize, User, Role, Menu, Categories };