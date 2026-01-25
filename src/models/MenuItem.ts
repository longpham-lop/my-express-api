import { pool } from "../config/db";

export class MenuItem {

  // CREATE
  static async create(data: any) {
    const rs = await pool.query(
      `INSERT INTO menu_items(name, price, category_id, description)
       VALUES($1,$2,$3,$4) RETURNING *`,
      [data.name, data.price, data.category_id, data.description]
    );
    return rs.rows[0];
  }

  // READ ALL
  static async findAll() {
    const rs = await pool.query("SELECT * FROM menu_items");
    return rs.rows;
  }

  // READ ONE
  static async findById(id: number) {
    const rs = await pool.query(
      "SELECT * FROM menu_items WHERE id=$1",
      [id]
    );
    return rs.rows[0];
  }

  // UPDATE
  static async update(id: number, data: any) {
    const rs = await pool.query(
      `UPDATE menu_items
       SET name=$1, price=$2, category_id=$3, description=$4
       WHERE id=$5 RETURNING *`,
      [data.name, data.price, data.category_id, data.description, id]
    );
    return rs.rows[0];
  }

  // DELETE
  static async delete(id: number) {
    await pool.query("DELETE FROM menu_items WHERE id=$1", [id]);
  }
}
