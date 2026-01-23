import type { Request, Response } from "express";

// Lấy danh sách món
export const getMenu = (req: Request, res: Response) => {
  res.json({
    menu: [
      {
        id: 1,
        name: "Cơm gà",
        price: 45000,
        category: "Món chính",
        status: "available",
      },
      {
        id: 2,
        name: "Trà đào",
        price: 25000,
        category: "Đồ uống",
        status: "available",
      },
    ],
  });
};

// Lấy chi tiết món
export const getMenuItemById = (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    id,
    name: "Cơm gà",
    price: 45000,
    category: "Món chính",
    description: "Cơm gà xối mỡ",
  });
};

// Thêm món
export const createMenuItem = (req: Request, res: Response) => {
    console.log(req.body);
  const { name, price, category, description } = req.body;

  res.json({
    message: "Menu item created",
    data: { name, price, category, description },
  });
};

// Cập nhật món
export const updateMenuItem = (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, price, category, description } = req.body;

  res.json({
    message: "Menu item updated",
    id,
    data: { name, price, category, description },
  });
};

// Xóa món
export const deleteMenuItem = (req: Request, res: Response) => {
  const { id } = req.params;

  res.json({
    message: "Menu item deleted",
    id,
  });
};
