import { pool } from "../config/db";

export class Payment {
  static async create(data: {
    order_id: number;
    payment_method: string;
  }) {
    const result = await pool.query(
      `
      INSERT INTO payments (order_id, payment_method, amount, status)
      SELECT id, $2, total_price, 'unpaid'
      FROM orders
      WHERE id = $1
      RETURNING *
      `,
      [data.order_id, data.payment_method]
    );

    return result.rows[0];
  }
}
