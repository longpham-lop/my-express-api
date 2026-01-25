import { pool } from "../config/db";

export class Order {
  static async create(userId: number) {
    const rs = await pool.query(
      "INSERT INTO orders(user_id, status) VALUES($1,'pending') RETURNING *",
      [userId]
    );
    return rs.rows[0];
  }

  static async getByUser(userId: number) {
    const rs = await pool.query(
      "SELECT * FROM orders WHERE user_id=$1",
      [userId]
    );
    return rs.rows;
  }
}
