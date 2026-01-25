import { pool } from "../config/db";

export class User {

  static async create(data: any) {
    const rs = await pool.query(
      `INSERT INTO users(fullname, email, password, role_id)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [data.fullname, data.email, data.password, data.role_id]
    );
    return rs.rows[0];
  }

  static async findAll() {
    const rs = await pool.query("SELECT * FROM users");
    return rs.rows;
  }

  static async findById(id: number) {
    const rs = await pool.query(
      "SELECT * FROM users WHERE id=$1",
      [id]
    );
    return rs.rows[0];
  }

  static async findByEmail(email: string) {
    const rs = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );
    return rs.rows[0];
  }

  static async delete(id: number) {
    await pool.query("DELETE FROM users WHERE id=$1", [id]);
  }
}
