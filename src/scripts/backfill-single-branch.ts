import sequelize from "../config/db";
import { QueryTypes } from "sequelize";

const tables = ["tables", "menu_items", "categories", "reservations", "orders"];

async function run() {
  const transaction = await sequelize.transaction();
  try {
    const branches = await sequelize.query<{ id: number }>(
      "SELECT id FROM branches WHERE status = 'active' ORDER BY id LIMIT 2",
      { transaction, type: QueryTypes.SELECT }
    );
    if (branches.length !== 1) {
      throw new Error("Backfill only runs when exactly one active branch exists.");
    }
    const branchId = branches[0].id;
    const result: Record<string, number> = {};
    for (const tableName of tables) {
      const [, metadata] = await sequelize.query(
        `UPDATE ${tableName} SET branch_id = :branchId WHERE branch_id IS NULL`,
        { replacements: { branchId }, transaction }
      );
      result[tableName] = Number((metadata as any).rowCount || 0);
    }
    await transaction.commit();
    console.log(JSON.stringify({ branch_id: branchId, updated: result }));
  } catch (error) {
    await transaction.rollback();
    throw error;
  } finally {
    await sequelize.close();
  }
}

void run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
