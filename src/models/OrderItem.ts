import { pool } from "../config/db";

export class OrderItem {

  // ADD ITEM TO ORDER
  static async add(data: any) {
    const rs = await pool.query(
      `INSERT INTO order_items(order_id, menu_item_id, quantity, price)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [data.order_id, data.menu_item_id, data.quantity, data.price]
    );
    return rs.rows[0];
  }

  // GET ITEMS BY ORDER
  static async getByOrder(orderId: number) {
    const rs = await pool.query(
      `SELECT oi.*, m.name
       FROM order_items oi
       JOIN menu_items m ON oi.menu_item_id = m.id
       WHERE oi.order_id=$1`,
      [orderId]
    );
    return rs.rows;
  }

  // UPDATE QUANTITY
  static async updateQty(id: number, quantity: number) {
    const rs = await pool.query(
      "UPDATE order_items SET quantity=$1 WHERE id=$2 RETURNING *",
      [quantity, id]
    );
    return rs.rows[0];
  }

  // REMOVE ITEM
  static async delete(id: number) {
    await pool.query("DELETE FROM order_items WHERE id=$1", [id]);
  }
}
