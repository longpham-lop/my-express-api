import { pool } from "../config/db";

export interface User {
  id: number;
  fullname: string;
  email: string;
  password: string;
  phone: string | null;
  role_id: number;
  created_at: Date;
}

export const getAllUsers = async (): Promise<User[]> => {
  const result = await pool.query("SELECT * FROM users");
  return result.rows;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
};
