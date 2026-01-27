import sequelize from "../config/db"; // default export
import { QueryTypes } from "sequelize";

export class CategoryModel {
  // Tạo category mới
  static async create(name: string) {
    const [result] = await sequelize.query(
      "INSERT INTO categories(name) VALUES(:name) RETURNING *",
      {
        replacements: { name },
        type: QueryTypes.INSERT, // dùng INSERT
      }
    );
    return result;
  }

  // Lấy tất cả category
  static async findAll() {
    const results = await sequelize.query("SELECT * FROM categories", {
      type: QueryTypes.SELECT,
    });
    return results;
  }
}

export default CategoryModel;