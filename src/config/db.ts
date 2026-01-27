// config/db.ts
import { Sequelize } from "sequelize"; 
import dotenv from "dotenv";

dotenv.config(); 


const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432;

const sequelize = new Sequelize(
  process.env.DB_NAME || "ordernow",
  process.env.DB_USER || "postgres",
  process.env.DB_PASSWORD || "123456",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    port: port,
    logging: false,
  }
);

export default sequelize;
