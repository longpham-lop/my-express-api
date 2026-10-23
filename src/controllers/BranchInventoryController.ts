import { Response } from "express";
import BranchInventory from "../models/BranchInventory";
import Branch from "../models/Branch";
import Ingredient from "../models/Ingredient";
import { AuthRequest } from "../middlewares/auth.middleware";
import sequelize from "../config/db";
import { UniqueConstraintError } from "sequelize";
import InventoryTransaction from "../models/InventoryTransaction";

const GLOBAL_ROLES = ["admin", "chain_manager"];
const MANAGE_ROLES = ["admin", "chain_manager", "branch_manager"];

const canAccessBranch = (
  role: string,
  userBranchId: number | null,
  branchId: number
) => {
  if (GLOBAL_ROLES.includes(role)) {
    return true;
  }

  return userBranchId === branchId;
};
const isPositiveInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value > 0;

const isValidQuantity = (value: number): boolean =>
  Number.isFinite(value) && value >= 0;
/* =========================================================
   GET ALL INVENTORY
========================================================= */

export const getAllInventory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const { role, branchId } = req.user;

    const where: {
      branch_id?: number;
    } = {};

    // Admin / chain_manager:
    // có thể xem tất cả hoặc lọc theo branch_id
    if (GLOBAL_ROLES.includes(role)) {
      if (req.query.branch_id !== undefined) {
        const requestedBranch = req.query.branch_id;

        if (
          typeof requestedBranch !== "string" ||
          !/^[1-9]\d*$/.test(requestedBranch)
        ) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        const requestedBranchId = Number(requestedBranch);
        if (!isPositiveInteger(requestedBranchId)) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        where.branch_id = requestedBranchId;
      }
    } else {
      // Branch manager / waiter / kitchen chỉ xem kho của chi nhánh mình.
      if (!branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      where.branch_id = branchId;
    }

    const inventory = await BranchInventory.findAll({
      where,

      include: [
        {
          model: Branch,
          as: "branch",
          attributes: [
            "id",
            "name",
            "code",
            "address",
          ],
        },
        {
          model: Ingredient,
          as: "ingredient",
          attributes: [
            "id",
            "name",
            "unit",
            "category",
            "minimum_stock",
            "status",
          ],
        },
      ],

      order: [["id", "ASC"]],
    });

    return res.status(200).json(inventory);
  } catch (error) {
    console.error("GET ALL INVENTORY ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy danh sách tồn kho",
    });
  }
};

/* =========================================================
   GET INVENTORY BY ID
========================================================= */

export const getInventoryById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({
        message: "ID tồn kho không hợp lệ",
      });
    }

    const inventory = await BranchInventory.findByPk(id, {
      include: [
        {
          model: Branch,
          as: "branch",
          attributes: [
            "id",
            "name",
            "code",
            "address",
          ],
        },
        {
          model: Ingredient,
          as: "ingredient",
          attributes: [
            "id",
            "name",
            "unit",
            "category",
            "minimum_stock",
            "status",
          ],
        },
      ],
    });

    if (!inventory) {
      return res.status(404).json({
        message: "Không tìm thấy tồn kho",
      });
    }

    const allowed = canAccessBranch(
      req.user.role,
      req.user.branchId,
      inventory.branch_id
    );

    if (!allowed) {
      return res.status(403).json({
        message: "Bạn không có quyền xem tồn kho của chi nhánh này",
      });
    }

    return res.status(200).json(inventory);
  } catch (error) {
    console.error("GET INVENTORY BY ID ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy thông tin tồn kho",
    });
  }
};

/* =========================================================
   CREATE INVENTORY
========================================================= */

export const createInventory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!MANAGE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền tạo tồn kho",
      });
    }

    const {
      branch_id,
      ingredient_id,
      quantity,
      minimum_stock,
    } = req.body;

    const branchId = Number(branch_id);
    const ingredientId = Number(ingredient_id);
    const stockQuantity = Number(quantity);
    const minimumStock = Number(minimum_stock ?? 0);

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "branch_id không hợp lệ",
      });
    }

    if (!Number.isInteger(ingredientId)) {
      return res.status(400).json({
        message: "ingredient_id không hợp lệ",
      });
    }

    if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
      return res.status(400).json({
        message: "quantity phải lớn hơn hoặc bằng 0",
      });
    }

    if (!Number.isFinite(minimumStock) || minimumStock < 0) {
      return res.status(400).json({
        message: "minimum_stock không hợp lệ",
      });
    }

    // Branch manager chỉ được thao tác chi nhánh của mình
    if (
      req.user.role === "branch_manager" &&
      req.user.branchId !== branchId
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền thao tác chi nhánh này",
      });
    }

    const branch = await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    const ingredient = await Ingredient.findByPk(ingredientId);

    if (!ingredient) {
      return res.status(404).json({
        message: "Không tìm thấy nguyên liệu",
      });
    }

    if (ingredient.status !== "active") {
      return res.status(400).json({
        message: "Nguyên liệu đang không hoạt động",
      });
    }

     
try {
  const inventory = await sequelize.transaction(
    async (transaction) => {
      const existing = await BranchInventory.findOne({
        where: {
          branch_id: branchId,
          ingredient_id: ingredientId,
        },
        transaction,
      });

      if (existing) {
        throw new Error("INVENTORY_ALREADY_EXISTS");
      }

      const createdInventory = await BranchInventory.create(
        {
          branch_id: branchId,
          ingredient_id: ingredientId,
          quantity: stockQuantity,
          minimum_stock: minimumStock,
        },
        { transaction }
      );

      if (stockQuantity > 0) {
        await InventoryTransaction.create(
          {
            branch_id: branchId,
            ingredient_id: ingredientId,
            type: "adjustment",
            quantity: stockQuantity,
            unit: ingredient.unit,
            reference_type: "initial_stock",
            reference_id: null,
            note: "Ghi nhận số lượng tồn kho ban đầu",
            created_by: req.user!.id,
          },
          { transaction }
        );
      }

      return createdInventory;
    }
  );

    return res.status(201).json({
      message: "Tạo tồn kho thành công",
      data: inventory,
    });
  } catch (error) {
    if (
      error instanceof UniqueConstraintError ||
      (error instanceof Error &&
        error.message === "INVENTORY_ALREADY_EXISTS")
    ) {
      return res.status(409).json({
        message: "Nguyên liệu này đã có tồn kho tại chi nhánh",
      });
    }

    throw error;
  }

  } catch (error) {
    console.error("CREATE INVENTORY ERROR:", error);

    return res.status(500).json({
      message: "Không thể tạo tồn kho",
    });
  }
};

/* =========================================================
   UPDATE INVENTORY
========================================================= */


export const updateInventory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!MANAGE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật tồn kho",
      });
    }

    const id = Number(req.params.id);

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "ID tồn kho không hợp lệ",
      });
    }

    const { quantity, minimum_stock } = req.body;

    if (quantity !== undefined) {
      return res.status(400).json({
        message:
          "Không được cập nhật quantity trực tiếp. Hãy sử dụng chức năng điều chỉnh tồn kho.",
      });
    }

    if (minimum_stock === undefined) {
      return res.status(400).json({
        message: "Không có dữ liệu cần cập nhật",
      });
    }

    const newMinimumStock = Number(minimum_stock);

    if (!isValidQuantity(newMinimumStock)) {
      return res.status(400).json({
        message: "minimum_stock không hợp lệ",
      });
    }

    const inventory = await sequelize.transaction(
      async (transaction) => {
        const currentInventory = await BranchInventory.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!currentInventory) {
          return null;
        }

        if (
          !canAccessBranch(
            req.user!.role,
            req.user!.branchId,
            currentInventory.branch_id
          )
        ) {
          throw new Error("INVENTORY_ACCESS_DENIED");
        }

        await currentInventory.update(
          {
            minimum_stock: newMinimumStock,
          },
          { transaction }
        );

        return currentInventory;
      }
    );

    if (!inventory) {
      return res.status(404).json({
        message: "Không tìm thấy tồn kho",
      });
    }

    return res.status(200).json({
      message: "Cập nhật tồn kho thành công",
      data: inventory,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "INVENTORY_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền cập nhật tồn kho này",
      });
    }

    console.error("UPDATE INVENTORY ERROR:", error);

    return res.status(500).json({
      message: "Không thể cập nhật tồn kho",
    });
  }
};


/* =========================================================
   DELETE INVENTORY
========================================================= */


export const deleteInventory = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (!MANAGE_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xóa tồn kho",
      });
    }

    const id = Number(req.params.id);

    if (!isPositiveInteger(id)) {
      return res.status(400).json({
        message: "ID tồn kho không hợp lệ",
      });
    }

    const result = await sequelize.transaction(
      async (transaction) => {
        const inventory = await BranchInventory.findByPk(id, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!inventory) {
          return "NOT_FOUND" as const;
        }

        if (
          !canAccessBranch(
            req.user!.role,
            req.user!.branchId,
            inventory.branch_id
          )
        ) {
          return "FORBIDDEN" as const;
        }

        if (Number(inventory.quantity) > 0) {
          return "HAS_STOCK" as const;
        }

        const transactionCount = await InventoryTransaction.count({
          where: {
            branch_id: inventory.branch_id,
            ingredient_id: inventory.ingredient_id,
          },
          transaction,
        });

        if (transactionCount > 0) {
          return "HAS_HISTORY" as const;
        }

        await inventory.destroy({ transaction });

        return "DELETED" as const;
      }
    );

    switch (result) {
      case "NOT_FOUND":
        return res.status(404).json({
          message: "Không tìm thấy tồn kho",
        });

      case "FORBIDDEN":
        return res.status(403).json({
          message: "Bạn không có quyền xóa tồn kho này",
        });

      case "HAS_STOCK":
        return res.status(409).json({
          message:
            "Không thể xóa tồn kho còn số lượng. Hãy điều chỉnh tồn kho về 0 trước.",
        });

      case "HAS_HISTORY":
        return res.status(409).json({
          message:
            "Không thể xóa tồn kho đã có lịch sử giao dịch. Hãy giữ lại bản ghi để đối soát.",
        });

      case "DELETED":
        return res.status(200).json({
          message: "Xóa tồn kho thành công",
        });
    }
  } catch (error) {
    console.error("DELETE INVENTORY ERROR:", error);

    return res.status(500).json({
      message: "Không thể xóa tồn kho",
    });
  }
};
