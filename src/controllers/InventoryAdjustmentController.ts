import { Response } from "express";
import sequelize from "../config/db";

import Branch from "../models/Branch";
import Ingredient from "../models/Ingredient";
import BranchInventory from "../models/BranchInventory";
import InventoryTransaction from "../models/InventoryTransaction";

import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = [
  "admin",
  "chain_manager",
];

const MANAGE_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

/**
 * =====================================================
 * ADJUST INVENTORY
 * =====================================================
 *
 * quantity > 0  => tăng tồn kho
 * quantity < 0  => giảm tồn kho
 *
 * Ví dụ:
 * +5  => tăng 5
 * -2  => giảm 2
 *
 * Không cho phép tồn kho sau điều chỉnh < 0.
 */
export const adjustInventory = async (
  req: AuthRequest,
  res: Response
) => {
  const transaction = await sequelize.transaction();

  try {
    // =====================================================
    // 1. CHECK LOGIN
    // =====================================================

    if (!req.user) {
      await transaction.rollback();

      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    // =====================================================
    // 2. CHECK ROLE
    // =====================================================

    if (!MANAGE_ROLES.includes(req.user.role)) {
      await transaction.rollback();

      return res.status(403).json({
        message:
          "Bạn không có quyền điều chỉnh tồn kho",
      });
    }

    // =====================================================
    // 3. LẤY DỮ LIỆU
    // =====================================================

    const branchId = Number(req.body.branch_id);
    const ingredientId = Number(req.body.ingredient_id);
    const quantity = Number(req.body.quantity);

    const unit =
      typeof req.body.unit === "string"
        ? req.body.unit.trim()
        : "";

    const note =
      typeof req.body.note === "string"
        ? req.body.note.trim()
        : null;

    // =====================================================
    // 4. VALIDATE BRANCH
    // =====================================================

    if (!Number.isInteger(branchId)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "branch_id không hợp lệ",
      });
    }

    // =====================================================
    // 5. VALIDATE INGREDIENT
    // =====================================================

    if (!Number.isInteger(ingredientId)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "ingredient_id không hợp lệ",
      });
    }

    // =====================================================
    // 6. VALIDATE QUANTITY
    // =====================================================

    if (!Number.isFinite(quantity)) {
      await transaction.rollback();

      return res.status(400).json({
        message: "quantity không hợp lệ",
      });
    }

    if (quantity === 0) {
      await transaction.rollback();

      return res.status(400).json({
        message:
          "quantity phải khác 0",
      });
    }

    // =====================================================
    // 7. VALIDATE UNIT
    // =====================================================

    if (!unit) {
      await transaction.rollback();

      return res.status(400).json({
        message: "unit là bắt buộc",
      });
    }

    // =====================================================
    // 8. BRANCH ISOLATION
    // =====================================================

    const isGlobalRole =
      GLOBAL_ROLES.includes(req.user.role);

    if (!isGlobalRole) {
      if (!req.user.branchId) {
        await transaction.rollback();

        return res.status(403).json({
          message:
            "Tài khoản chưa được gán chi nhánh",
        });
      }

      if (req.user.branchId !== branchId) {
        await transaction.rollback();

        return res.status(403).json({
          message:
            "Bạn không có quyền điều chỉnh tồn kho của chi nhánh khác",
        });
      }
    }

    // =====================================================
    // 9. CHECK BRANCH
    // =====================================================

    const branch = await Branch.findByPk(
      branchId,
      {
        transaction,
      }
    );

    if (!branch) {
      await transaction.rollback();

      return res.status(404).json({
        message:
          "Không tìm thấy chi nhánh",
      });
    }

    // =====================================================
    // 10. CHECK INGREDIENT
    // =====================================================

    const ingredient =
      await Ingredient.findByPk(
        ingredientId,
        {
          transaction,
        }
      );

    if (!ingredient) {
      await transaction.rollback();

      return res.status(404).json({
        message:
          `Không tìm thấy nguyên liệu ID ${ingredientId}`,
      });
    }

    // =====================================================
    // 11. CHECK INGREDIENT ACTIVE
    // =====================================================

    if (ingredient.status !== "active") {
      await transaction.rollback();

      return res.status(400).json({
        message:
          `Nguyên liệu "${ingredient.name}" đang inactive`,
      });
    }

    // =====================================================
    // 12. FIND INVENTORY
    // =====================================================

    let inventory =
      await BranchInventory.findOne({
        where: {
          branch_id: branchId,
          ingredient_id: ingredientId,
        },
        transaction,

        // Khóa row để tránh 2 request
        // cùng lúc làm sai quantity
        lock: transaction.LOCK.UPDATE,
      });

    // =====================================================
    // 13. CHƯA CÓ INVENTORY
    // =====================================================

    if (!inventory) {
      // Nếu chưa có tồn kho mà điều chỉnh âm
      // thì không thể thực hiện.
      if (quantity < 0) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            "Nguyên liệu chưa có tồn kho, không thể điều chỉnh giảm",
        });
      }

      // Điều chỉnh dương
      inventory =
        await BranchInventory.create(
          {
            branch_id: branchId,
            ingredient_id: ingredientId,
            quantity,
            minimum_stock: 0,
          },
          {
            transaction,
          }
        );
    } else {
      // =====================================================
      // 14. TÍNH TỒN KHO MỚI
      // =====================================================

      const currentQuantity =
        Number(inventory.quantity);

      const newQuantity =
        currentQuantity + quantity;

      // =====================================================
      // 15. KHÔNG CHO TỒN KHO ÂM
      // =====================================================

      if (newQuantity < 0) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            `Không thể điều chỉnh. Tồn kho hiện tại là ${currentQuantity}, điều chỉnh ${quantity} sẽ làm tồn kho âm`,
        });
      }

      // =====================================================
      // 16. UPDATE INVENTORY
      // =====================================================

      await inventory.update(
        {
          quantity: newQuantity,
        },
        {
          transaction,
        }
      );
    }

    // =====================================================
    // 17. CREATE INVENTORY TRANSACTION
    // =====================================================

    const inventoryTransaction =
      await InventoryTransaction.create(
        {
          branch_id: branchId,
          ingredient_id: ingredientId,

          type: "adjustment",

          // Giữ dấu + / -
          quantity,

          unit,

          reference_type:
            "stock_adjustment",

          reference_id: null,

          note:
            note ||
            `Điều chỉnh tồn kho nguyên liệu "${ingredient.name}"`,

          created_by:
            req.user.id,
        },
        {
          transaction,
        }
      );

    // =====================================================
    // 18. COMMIT
    // =====================================================

    await transaction.commit();

    // =====================================================
    // 19. RESPONSE
    // =====================================================

    return res.status(200).json({
      message:
        "Điều chỉnh tồn kho thành công",

      data: {
        branch_id: branchId,

        ingredient_id: ingredientId,

        ingredient_name:
          ingredient.name,

        adjustment_quantity:
          quantity,

        unit,

        current_quantity:
          Number(inventory.quantity),

        transaction_id:
          inventoryTransaction.id,
      },
    });
  } catch (error) {
    await transaction.rollback();

    console.error(
      "ADJUST INVENTORY ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể điều chỉnh tồn kho",
    });
  }
};