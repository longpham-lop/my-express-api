import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

/**
 * Validate env trước khi kết nối DB
 * -> fail sớm, dễ debug
 */
if (!process.env.DB_HOST ||
    !process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_NAME) {
  throw new Error("❌ Missing database environment variables");
}

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, 
  database: process.env.DB_NAME,
});

/**
 * Test kết nối DB
 */
pool.query("SELECT 1")
  .then(() => console.log("✅ Connected to PostgreSQL"))
  .catch(err => console.error("❌ DB error:", err));
