
import { Response } from "express";
import { Op, WhereOptions } from "sequelize";

import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Menu from "../models/Menu";
import { AuthRequest } from "../middlewares/auth.middleware";

const GLOBAL_ROLES = ["admin", "chain_manager"];
const REPORT_ROLES = ["admin", "chain_manager", "branch_manager"];

interface AnalyticsMenu {
  id: number;
  name: string;
}

interface AnalyticsOrderItem {
  id: number;
  menu_item_id: number;
  quantity: number | string;
  status: string;
  menu?: AnalyticsMenu | null;
}

interface AnalyticsOrder {
  id: number;
  branch_id: number | null;
  createdAt: Date;
  items?: AnalyticsOrderItem[];
}


const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};


export const getSalesAnalytics = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Bạn chưa đăng nhập",
      });
    }

    if (!REPORT_ROLES.includes(req.user.role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem thống kê bán hàng",
      });
    }

    const today = new Date();
    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");

    const firstDayOfMonth = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      "01",
    ].join("-");

    const startDateString = req.query.start_date
      ? String(req.query.start_date)
      : firstDayOfMonth;

    const endDateString = req.query.end_date
      ? String(req.query.end_date)
      : todayString;

    if (
      !isValidDate(startDateString) ||
      !isValidDate(endDateString)
    ) {
      return res.status(400).json({
        message: "Ngày bắt đầu hoặc ngày kết thúc không hợp lệ",
      });
    }

    if (startDateString > endDateString) {
      return res.status(400).json({
        message: "Ngày bắt đầu không được sau ngày kết thúc",
      });
    }

    const startDate = new Date(`${startDateString}T00:00:00`);
    const endExclusive = new Date(
      new Date(`${endDateString}T00:00:00`).getTime() +
        24 * 60 * 60 * 1000
    );

    let selectedBranchId: number | undefined;

    if (GLOBAL_ROLES.includes(req.user.role)) {
      if (req.query.branch_id !== undefined) {
        const branchId = Number(req.query.branch_id);

        if (!Number.isInteger(branchId) || branchId <= 0) {
          return res.status(400).json({
            message: "branch_id không hợp lệ",
          });
        }

        selectedBranchId = branchId;
      }
    } else {
      const assignedBranchId = Number(req.user.branchId);

      if (!Number.isInteger(assignedBranchId) || assignedBranchId <= 0) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      selectedBranchId = assignedBranchId;
    }

    const orderWhere: WhereOptions = {
      is_deleted: false,
      status: { [Op.ne]: "cancelled" },
      createdAt: {
        [Op.gte]: startDate,
        [Op.lt]: endExclusive,
      },
      ...(selectedBranchId !== undefined
        ? { branch_id: selectedBranchId }
        : {}),
    };

    const orders = await Order.findAll({
      where: orderWhere,
      attributes: ["id", "branch_id", "createdAt"],
      include: [
        {
          model: OrderItem,
          as: "items",
          attributes: [
            "id",
            "menu_item_id",
            "quantity",
            "status",
          ],
          where: {
            status: { [Op.ne]: "cancelled" },
          },
          required: false,
          include: [
            {
              model: Menu,
              as: "menu",
              attributes: ["id", "name"],
              required: false,
            },
          ],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    const orderData = orders as unknown as AnalyticsOrder[];

    const dishMap = new Map<
      number,
      {
        menu_item_id: number;
        name: string;
        quantity_sold: number;
        order_count: number;
      }
    >();

    const hourMap = new Map<number, number>();

    for (const order of orderData) {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();

      hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);

      for (const item of order.items ?? []) {
        if (item.status === "cancelled") continue;

        const menuId = Number(item.menu_item_id);
        const quantity = Number(item.quantity);

        if (!Number.isInteger(menuId) || menuId <= 0) continue;
        if (!Number.isFinite(quantity) || quantity <= 0) continue;

        const current = dishMap.get(menuId) ?? {
          menu_item_id: menuId,
          name: item.menu?.name ?? `Món #${menuId}`,
          quantity_sold: 0,
          order_count: 0,
        };

        current.quantity_sold += quantity;
        current.order_count += 1;

        dishMap.set(menuId, current);
      }
    }

    const topDishes = Array.from(dishMap.values())
      .sort(
        (a, b) =>
          b.quantity_sold - a.quantity_sold ||
          b.order_count - a.order_count
      )
      .slice(0, 10);

    const hourlySales = Array.from(hourMap.entries())
      .map(([hour, order_count]) => ({
        hour,
        label: `${String(hour).padStart(2, "0")}:00`,
        order_count,
      }))
      .sort((a, b) => a.hour - b.hour);

    const peakHour = hourlySales.reduce<
      (typeof hourlySales)[number] | null
    >(
      (best, current) =>
        !best || current.order_count > best.order_count
          ? current
          : best,
      null
    );

    return res.json({
      message: "Lấy thống kê bán hàng thành công",
      filters: {
        start_date: startDateString,
        end_date: endDateString,
        branch_id: selectedBranchId ?? null,
      },
      summary: {
        total_orders: orderData.length,
        unique_dishes: dishMap.size,
        peak_hour: peakHour
          ? {
              hour: peakHour.hour,
              label: `${String(peakHour.hour).padStart(2, "0")}:00 - ${String(
                (peakHour.hour + 1) % 24
              ).padStart(2, "0")}:00`,
              order_count: peakHour.order_count,
            }
          : null,
      },
      top_dishes: topDishes,
      hourly_sales: hourlySales,
    });
  } catch (error: unknown) {
    console.error("GET SALES ANALYTICS ERROR:", error);

    return res.status(500).json({
      message: "Không thể lấy thống kê bán hàng",
      error:
        error instanceof Error
          ? error.message
          : "Lỗi không xác định",
    });
  }
};
