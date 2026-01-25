import { pool } from "../config/db";

export class Reservation {
  static async create(data: any) {
    const rs = await pool.query(
      `INSERT INTO reservations(user_id, table_id, reserve_date, reserve_time, status)
       VALUES($1,$2,$3,$4,'pending') RETURNING *`,
      [data.user_id, data.table_id, data.reserve_date, data.reserve_time]
    );
    return rs.rows[0];
  }

  static async cancel(id: number) {
    await pool.query(
      "UPDATE reservations SET status='cancelled' WHERE id=$1",
      [id]
    );
  }
}
