import { pool } from "../config/db";

export class TableModel {
  static async findAll() {
    const rs = await pool.query("SELECT * FROM tables");
    return rs.rows;
  }

  static async updateStatus(id: number, status: string) {
    const rs = await pool.query(
      "UPDATE tables SET status=$1 WHERE id=$2 RETURNING *",
      [status, id]
    );
    return rs.rows[0];
  }
}
