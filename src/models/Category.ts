import { pool } from "../config/db";

export class Category {
  static async create(name: string) {
    const rs = await pool.query(
      "INSERT INTO categories(name) VALUES($1) RETURNING *",
      [name]
    );
    return rs.rows[0];
  }

  static async findAll() {
    const rs = await pool.query("SELECT * FROM categories");
    return rs.rows;
  }
}
