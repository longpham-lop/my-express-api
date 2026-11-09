
import { Request, Response } from "express";
import { Op, Transaction, WhereOptions } from "sequelize";
import { randomInt } from "crypto";
import bcrypt from "bcryptjs";

import sequelize from "../config/db";

import Reservation from "../models/Reservation";
import TableModel from "../models/Table";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Branch from "../models/Branch";
import OtpRequest from "../models/OtpRequest";
import Menu from "../models/Menu";
import StaffBranch from "../models/StaffBranch";

import sgMail, {
  isEmailDeliveryConfigured,
} from "../config/sendgrid";

import { getIO } from "../socket";

/* =========================================================
   TYPES
========================================================= */

interface AuthUser {
  id: number;
  email?: string;
  role: string;
  branchId: number | null;
}

interface AuthRequest extends Request {
  user?: AuthUser;
}

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled";

interface CartItem {
  id: number | string;
  quantity: number;
}

interface ValidatedCartItem {
  menu_item_id: number;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface ValidatedCart {
  items: ValidatedCartItem[];
  total: number;
}

interface CreateReservationInput {
  branch_id?: number;
  table_id?: number;
  reservation_time?: string | Date;
  start_time?: string;
  guest_count?: number;
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
  cart?: CartItem[];
}

interface OnlineReservationInput extends CreateReservationInput {
  otp_request_id?: number;
  otp_code?: string;
}

/* =========================================================
   CONSTANTS
========================================================= */

const MANAGER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const RESERVATION_VIEW_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
  "waiter",
];

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
];

const RESERVATION_DURATION_MINUTES = 90;

const OTP_EXPIRATION_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;

/* =========================================================
   BASIC HELPERS
========================================================= */

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error
    ? error.message
    : "Unknown error";
};

const parseId = (
  value: string | string[] | undefined
): number | null => {
  const rawValue = Array.isArray(value)
    ? value[0]
    : value;

  if (typeof rawValue !== "string") {
    return null;
  }

  const id = Number(rawValue);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
};

const isValidPositiveId = (value: number): boolean => {
  return Number.isSafeInteger(value) && value > 0;
};

const parseReservationTime = (
  value: unknown
): Date | null => {
  if (
    typeof value !== "string" &&
    !(value instanceof Date)
  ) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const isValidPhone = (phone: string): boolean => {
  return /^(0|\+84)[0-9]{9,10}$/.test(phone);
};

const getReservationEndTime = (
  startTime: Date
): Date => {
  return new Date(
    startTime.getTime() +
      RESERVATION_DURATION_MINUTES * 60 * 1000
  );
};

const isPastReservationTime = (
  startTime: Date
): boolean => {
  return startTime.getTime() <= Date.now();
};

const isManager = (role: string): boolean => {
  return MANAGER_ROLES.includes(role);
};

/* =========================================================
   BRANCH PERMISSION
========================================================= */

const canManageBranch = async (
  user: AuthUser,
  branchId: number | null | undefined
): Promise<boolean> => {
  if (branchId == null) {
    return false;
  }

  const targetBranchId = Number(branchId);

  if (!isValidPositiveId(targetBranchId)) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  if (user.role === "chain_manager") {
    const assignment = await StaffBranch.findOne({
      where: {
        user_id: user.id,
        branch_id: targetBranchId,
        is_active: true,
      },
    });

    return Boolean(assignment);
  }

  if (user.role === "branch_manager") {
    return Number(user.branchId) === targetBranchId;
  }

  return false;
};

/* =========================================================
   TABLE CONFLICT CHECK
========================================================= */

const hasReservationConflict = async (params: {
  branchId: number;
  tableId: number;
  startTime: Date;
  excludeReservationId?: number;
  transaction?: Transaction;
}): Promise<boolean> => {
  const {
    branchId,
    tableId,
    startTime,
    excludeReservationId,
    transaction,
  } = params;

  const newEndTime = getReservationEndTime(startTime);

  const whereCondition: WhereOptions = {
    branch_id: branchId,
    table_id: tableId,
    status: {
      [Op.in]: ACTIVE_RESERVATION_STATUSES,
    },
    reservation_time: {
      [Op.lt]: newEndTime,
    },
  };

  if (excludeReservationId !== undefined) {
    whereCondition.id = {
      [Op.ne]: excludeReservationId,
    };
  }

  const reservations = await Reservation.findAll({
    where: whereCondition,
    attributes: [
      "id",
      "reservation_time",
      "end_time",
    ],
    transaction,
  });

  return reservations.some((reservation) => {
    const existingStart = new Date(
      reservation.reservation_time
    );

    const existingEnd = reservation.end_time
      ? new Date(reservation.end_time)
      : getReservationEndTime(existingStart);

    return (
      existingStart.getTime() < newEndTime.getTime() &&
      existingEnd.getTime() > startTime.getTime()
    );
  });
};

/* =========================================================
   VALIDATE BRANCH
========================================================= */

const validateBranch = async (
  branchId: number
): Promise<Branch> => {
  const branch = await Branch.findByPk(branchId);

  if (!branch) {
    throw new Error("Không tìm thấy chi nhánh");
  }

  if (branch.status !== "active") {
    throw new Error("Chi nhánh hiện không hoạt động");
  }

  if (!branch.is_accepting_reservations) {
    throw new Error("Chi nhánh hiện không nhận đặt bàn");
  }

  return branch;
};

/* =========================================================
   VALIDATE AND PRICE CART
   Không tin giá frontend gửi lên.
========================================================= */

const validateAndPriceCart = async (
  cart: CartItem[] | undefined,
  branchId: number,
  transaction: Transaction
): Promise<ValidatedCart> => {
  if (cart === undefined) {
    return {
      items: [],
      total: 0,
    };
  }

  if (!Array.isArray(cart)) {
    throw new Error("Giỏ hàng không hợp lệ");
  }

  if (cart.length === 0) {
    return {
      items: [],
      total: 0,
    };
  }

  if (cart.length > 100) {
    throw new Error("Giỏ hàng có quá nhiều món");
  }

  const quantityByMenuId = new Map<number, number>();

  for (const item of cart) {
    const menuItemId = Number(item.id);
    const quantity = Number(item.quantity);

    if (
      !Number.isSafeInteger(menuItemId) ||
      menuItemId <= 0 ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > 99
    ) {
      throw new Error(
        "Thông tin món ăn hoặc số lượng không hợp lệ"
      );
    }

    const currentQuantity =
      quantityByMenuId.get(menuItemId) ?? 0;

    const nextQuantity = currentQuantity + quantity;

    if (nextQuantity > 99) {
      throw new Error(
        "Tổng số lượng một món không được vượt quá 99"
      );
    }

    quantityByMenuId.set(
      menuItemId,
      nextQuantity
    );
  }

  const menuIds = Array.from(quantityByMenuId.keys());

  const menuItems = await Menu.findAll({
    where: {
      id: {
        [Op.in]: menuIds,
      },
      isActive: true,
      is_deleted: false,
      [Op.or]: [
        {
          branch_id: branchId,
        },
        {
          branch_id: null,
        },
      ],
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (menuItems.length !== menuIds.length) {
    throw new Error(
      "Một hoặc nhiều món không tồn tại, đã ngừng bán hoặc không thuộc chi nhánh này"
    );
  }

  const menuMap = new Map(
    menuItems.map((item) => [
      Number(item.id),
      item,
    ])
  );

  const items: ValidatedCartItem[] = [];

  let total = 0;

  for (const [menuItemId, quantity] of quantityByMenuId) {
    const menuItem = menuMap.get(menuItemId);

    if (!menuItem) {
      throw new Error("Không tìm thấy món ăn");
    }

    const price = Number(menuItem.price);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error("Giá món ăn không hợp lệ");
    }

    const subtotal = price * quantity;

    if (
      !Number.isFinite(subtotal) ||
      !Number.isSafeInteger(Math.round(subtotal))
    ) {
      throw new Error("Giá trị món ăn không hợp lệ");
    }

    total += subtotal;

    items.push({
      menu_item_id: menuItemId,
      name: menuItem.name,
      price,
      quantity,
      subtotal,
    });
  }

  if (
    !Number.isFinite(total) ||
    total < 0 ||
    !Number.isSafeInteger(Math.round(total))
  ) {
    throw new Error("Tổng tiền đơn hàng không hợp lệ");
  }

  return {
    items,
    total,
  };
};

/* =========================================================
   CREATE ORDER FROM VALIDATED CART
========================================================= */

const createOrderFromCart = async (params: {
  reservationId: number;
  branchId: number;
  userId: number | null;
  cart: ValidatedCart;
  transaction: Transaction;
}): Promise<Order | null> => {
  const {
    reservationId,
    branchId,
    userId,
    cart,
    transaction,
  } = params;

  if (cart.items.length === 0) {
    return null;
  }

  const order = await Order.create(
    {
      branch_id: branchId,
      reservation_id: reservationId,
      user_id: userId,
      total_price: cart.total,
      status: "pending",
      is_deleted: false,
    },
    {
      transaction,
    }
  );

  await OrderItem.bulkCreate(
    cart.items.map((item) => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.price,
      status: "pending" as const,
    })),
    {
      transaction,
    }
  );

  return order;
};

/* =========================================================
   SOCKET
========================================================= */

const emitReservationEvent = (
  eventName: string,
  branchId: number | null | undefined,
  payload: Record<string, unknown>
): void => {
  try {
    const io = getIO();

    const rooms =
      branchId != null
        ? io
            .to(`branch:${branchId}:reservations`)
            .to("role:global")
        : io.to("role:global");

    rooms.emit(eventName, payload);
  } catch (error) {
    console.warn(
      "RESERVATION SOCKET WARNING:",
      error
    );
  }
};

/* =========================================================
   EMAIL
========================================================= */

const sendReservationEmail = async (params: {
  email?: string;
  name: string;
  branchName: string;
  branchAddress: string;
  reservationTime: Date;
  guestCount: number;
  phone: string;
}): Promise<"sent" | "skipped" | "failed"> => {
  const {
    email,
    name,
    branchName,
    branchAddress,
    reservationTime,
    guestCount,
    phone,
  } = params;

  if (!email || !isEmailDeliveryConfigured()) {
    return "skipped";
  }

  try {
    await sgMail.send({
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL || "",
      subject: "Xác nhận đặt bàn",
      text: `
Xin chào ${name},

Bạn đã đặt bàn thành công!

Chi nhánh: ${branchName}
Địa chỉ: ${branchAddress}
Thời gian: ${reservationTime.toLocaleString("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
})}
Số khách: ${guestCount}
Số điện thoại: ${phone}

Vui lòng đến đúng giờ và báo tên hoặc số điện thoại cho nhân viên.
      `,
    });

    return "sent";
  } catch (error) {
    console.error(
      "RESERVATION EMAIL FAILED:",
      error
    );

    return "failed";
  }
};

/* =========================================================
   CHECK RESERVATION AVAILABILITY
========================================================= */

export const checkReservationAvailability = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      branch_id,
      start_time,
      guest_count,
    } = req.body as {
      branch_id?: number;
      start_time?: string;
      guest_count?: number;
    };

    const branchId = Number(branch_id);
    const guestCount = Number(guest_count);

    if (!isValidPositiveId(branchId)) {
      return res.status(400).json({
        message: "Chi nhánh không hợp lệ",
      });
    }

    if (
      !Number.isInteger(guestCount) ||
      guestCount <= 0 ||
      guestCount > 100
    ) {
      return res.status(400).json({
        message: "Số khách không hợp lệ",
      });
    }

    const reservationTime =
      parseReservationTime(start_time);

    if (!reservationTime) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    if (isPastReservationTime(reservationTime)) {
      return res.status(400).json({
        message: "Không thể đặt bàn vào thời gian đã qua",
      });
    }

    const branch = await validateBranch(branchId);

    const timeString = reservationTime
      .toTimeString()
      .slice(0, 8);

    if (
      timeString < branch.opening_time ||
      timeString >= branch.closing_time
    ) {
      return res.status(400).json({
        message:
          `Chi nhánh chỉ nhận đặt bàn từ ${branch.opening_time} đến ${branch.closing_time}`,
      });
    }

    const tables = await TableModel.findAll({
      where: {
        branch_id: branchId,
      },
      order: [
        ["capacity", "ASC"],
        ["id", "ASC"],
      ],
    });

    const availableTables = [];

    for (const table of tables) {
      if (
        table.status === "occupied" ||
        table.capacity < guestCount
      ) {
        continue;
      }

      const hasConflict = await hasReservationConflict({
        branchId,
        tableId: table.id,
        startTime: reservationTime,
      });

      if (!hasConflict) {
        availableTables.push(table);
      }
    }

    return res.status(200).json({
      message:
        availableTables.length > 0
          ? "Tìm thấy bàn phù hợp"
          : "Không còn bàn phù hợp",
      data: availableTables.map((table) => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        type: table.type,
      })),
    });
  } catch (error) {
    console.error(
      "CHECK RESERVATION AVAILABILITY ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể kiểm tra bàn trống",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   REQUEST OTP
========================================================= */

export const requestReservationOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const { phone } = req.body as {
      phone?: string;
    };

    const normalizedPhone = String(phone ?? "").trim();

    if (!normalizedPhone || !isValidPhone(normalizedPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ",
      });
    }

    const code = randomInt(100000, 1000000).toString();

    const codeHash = await bcrypt.hash(code, 10);

    const expiresAt = new Date(
      Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000
    );

    const otpRequest = await OtpRequest.create({
      phone: normalizedPhone,
      purpose: "reservation",
      code_hash: codeHash,
      expires_at: expiresAt,
      attempts: 0,
      max_attempts: OTP_MAX_ATTEMPTS,
    });

    return res.status(200).json({
      message: "Đã tạo yêu cầu OTP",
      data: {
        otp_request_id: otpRequest.id,
        debug_code:
          process.env.NODE_ENV !== "production"
            ? code
            : undefined,
        expires_at: expiresAt,
      },
    });
  } catch (error) {
    console.error(
      "REQUEST RESERVATION OTP ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể tạo mã OTP",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   CREATE ONLINE RESERVATION WITH OTP
========================================================= */

export const createOnlineReservation = async (
  req: AuthRequest,
  res: Response
) => {
  let transaction: Transaction | null = null;

  try {
    const {
      branch_id,
      table_id,
      start_time,
      guest_count,
      name,
      phone,
      email,
      note,
      otp_request_id,
      otp_code,
      cart,
    } = req.body as OnlineReservationInput;

    const branchId = Number(branch_id);
    const tableId = Number(table_id);
    const guestCount = Number(guest_count);
    const otpRequestId = Number(otp_request_id);

    const normalizedName = String(name ?? "").trim();
    const normalizedPhone = String(phone ?? "").trim();
    const normalizedEmail = String(email ?? "").trim();

    const reservationTime =
      parseReservationTime(start_time);

    if (!isValidPositiveId(branchId)) {
      return res.status(400).json({
        message: "Chi nhánh không hợp lệ",
      });
    }

    if (!isValidPositiveId(tableId)) {
      return res.status(400).json({
        message: "Bàn không hợp lệ",
      });
    }

    if (!reservationTime) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    if (isPastReservationTime(reservationTime)) {
      return res.status(400).json({
        message: "Không thể đặt bàn vào thời gian đã qua",
      });
    }

    if (
      !Number.isInteger(guestCount) ||
      guestCount <= 0 ||
      guestCount > 100
    ) {
      return res.status(400).json({
        message: "Số khách không hợp lệ",
      });
    }

    if (!normalizedName) {
      return res.status(400).json({
        message: "Vui lòng nhập họ tên",
      });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ",
      });
    }

    if (
      !isValidPositiveId(otpRequestId) ||
      !/^[0-9]{6}$/.test(String(otp_code ?? "").trim())
    ) {
      return res.status(400).json({
        message: "Thông tin OTP không hợp lệ",
      });
    }

    transaction = await sequelize.transaction();

    const branch = await Branch.findByPk(branchId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!branch) {
      throw new Error("Không tìm thấy chi nhánh");
    }

    if (
      branch.status !== "active" ||
      !branch.is_accepting_reservations
    ) {
      throw new Error("Chi nhánh hiện không nhận đặt bàn");
    }

    const table = await TableModel.findByPk(tableId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!table || Number(table.branch_id) !== branchId) {
      throw new Error("Bàn không thuộc chi nhánh đã chọn");
    }

    if (table.status === "occupied") {
      throw new Error("Bàn hiện đang có khách sử dụng");
    }

    if (guestCount > table.capacity) {
      throw new Error(
        `Bàn chỉ phục vụ tối đa ${table.capacity} người`
      );
    }

    const timeString = reservationTime
      .toTimeString()
      .slice(0, 8);

    if (
      timeString < branch.opening_time ||
      timeString >= branch.closing_time
    ) {
      throw new Error("Thời gian đặt bàn nằm ngoài giờ hoạt động");
    }

    const otpRequest = await OtpRequest.findOne({
      where: {
        id: otpRequestId,
        phone: normalizedPhone,
        purpose: "reservation",
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!otpRequest) {
      throw new Error("Mã OTP không tồn tại hoặc không hợp lệ");
    }

    if (otpRequest.verified_at) {
      throw new Error("Mã OTP này đã được sử dụng");
    }

    if (
      new Date(otpRequest.expires_at).getTime() <= Date.now()
    ) {
      throw new Error("Mã OTP đã hết hạn");
    }

    if (
      otpRequest.attempts >= otpRequest.max_attempts
    ) {
      throw new Error("Bạn đã nhập sai OTP quá số lần cho phép");
    }

    const isValidOtp = await bcrypt.compare(
      String(otp_code).trim(),
      otpRequest.code_hash
    );

    if (!isValidOtp) {
      await otpRequest.increment("attempts", {
        transaction,
      });

      await transaction.commit();
      transaction = null;

      return res.status(400).json({
        message: "Mã OTP không chính xác",
      });
    }

    const hasConflict = await hasReservationConflict({
      branchId,
      tableId,
      startTime: reservationTime,
      transaction,
    });

    if (hasConflict) {
      throw new Error("Bàn vừa được khách khác đặt");
    }

    const validatedCart = await validateAndPriceCart(
      cart,
      branchId,
      transaction
    );

    const reservation = await Reservation.create(
      {
        branch_id: branchId,
        table_id: tableId,
        reservation_time: reservationTime,
        end_time: getReservationEndTime(reservationTime),
        customer_name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail || null,
        branch: branch.name,
        note: note?.trim() || "",
        guest_count: guestCount,
        user_id: req.user?.id ?? null,
        status: "pending",
      },
      {
        transaction,
      }
    );

    const order = await createOrderFromCart({
      reservationId: reservation.id,
      branchId,
      userId: req.user?.id ?? null,
      cart: validatedCart,
      transaction,
    });

    await otpRequest.update(
      {
        verified_at: new Date(),
      },
      {
        transaction,
      }
    );

    await transaction.commit();
    transaction = null;

    emitReservationEvent(
      "new-reservation",
      branchId,
      {
        id: reservation.id,
        branch_id: branchId,
        table_id: tableId,
        name: normalizedName,
        phone: normalizedPhone,
        time: reservationTime,
        status: "pending",
      }
    );

    const notificationStatus = await sendReservationEmail({
      email: normalizedEmail,
      name: normalizedName,
      branchName: branch.name,
      branchAddress: branch.address,
      reservationTime,
      guestCount,
      phone: normalizedPhone,
    });

    return res.status(201).json({
      message: "Xác nhận đặt bàn thành công",
      data: {
        reservation,
        order,
        notificationStatus,
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error(
      "CREATE ONLINE RESERVATION ERROR:",
      error
    );

    const message = getErrorMessage(error);

    const isBusinessError = [
      "Không tìm thấy",
      "không thuộc",
      "không nhận",
      "không hợp lệ",
      "không chính xác",
      "đã sử dụng",
      "đã hết hạn",
      "quá số lần",
      "đang có khách",
      "vừa được khách",
      "chỉ phục vụ",
      "ngoài giờ",
      "không thể đặt",
      "không tồn tại",
      "ngừng bán",
      "Giá",
      "Giỏ hàng",
      "Số lượng",
      "Tổng số lượng",
      "Tổng tiền",
    ].some((text) => message.includes(text));

    return res.status(isBusinessError ? 400 : 500).json({
      message: "Không thể tạo đặt bàn",
      error: message,
    });
  }
};

/* =========================================================
   CREATE RESERVATION
   Dùng cho luồng nhân viên tạo đặt bàn.
========================================================= */

export const createReservation = async (
  req: AuthRequest,
  res: Response
) => {
  let transaction: Transaction | null = null;

  try {
    const {
      table_id,
      reservation_time,
      name,
      phone,
      email,
      note,
      cart,
      guest_count,
    } = req.body as CreateReservationInput;

    const tableId = Number(table_id);
    const guestCount = Number(guest_count);

    const normalizedName = String(name ?? "").trim();
    const normalizedPhone = String(phone ?? "").trim();
    const normalizedEmail = String(email ?? "").trim();

    const reservationTime =
      parseReservationTime(reservation_time);

    if (!isValidPositiveId(tableId)) {
      return res.status(400).json({
        message: "ID bàn không hợp lệ",
      });
    }

    if (!reservationTime) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    if (isPastReservationTime(reservationTime)) {
      return res.status(400).json({
        message: "Không thể đặt bàn vào thời gian đã qua",
      });
    }

    if (
      !Number.isInteger(guestCount) ||
      guestCount <= 0 ||
      guestCount > 100
    ) {
      return res.status(400).json({
        message: "Số lượng khách không hợp lệ",
      });
    }

    if (!normalizedName) {
      return res.status(400).json({
        message: "Vui lòng nhập họ tên",
      });
    }

    if (!isValidPhone(normalizedPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ",
      });
    }

    transaction = await sequelize.transaction();

    const table = await TableModel.findByPk(tableId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!table || !table.branch_id) {
      throw new Error("Bàn không tồn tại hoặc chưa được gán chi nhánh");
    }

    const branchId = Number(table.branch_id);

    const branch = await Branch.findByPk(branchId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!branch) {
      throw new Error("Không tìm thấy chi nhánh");
    }

    if (
      branch.status !== "active" ||
      !branch.is_accepting_reservations
    ) {
      throw new Error("Chi nhánh hiện không nhận đặt bàn");
    }

    if (table.status === "occupied") {
      throw new Error("Bàn hiện đang có khách sử dụng");
    }

    if (guestCount > table.capacity) {
      throw new Error(
        `Bàn chỉ phục vụ tối đa ${table.capacity} người`
      );
    }

    if (
      req.user &&
      isManager(req.user.role) &&
      !(await canManageBranch(req.user, branchId))
    ) {
      throw new Error("Bạn không có quyền thao tác tại chi nhánh này");
    }

    if (
      req.user &&
      ["waiter", "cashier"].includes(req.user.role) &&
      Number(req.user.branchId) !== branchId
    ) {
      throw new Error("Bạn không có quyền thao tác tại chi nhánh này");
    }

    const timeString = reservationTime
      .toTimeString()
      .slice(0, 8);

    if (
      timeString < branch.opening_time ||
      timeString >= branch.closing_time
    ) {
      throw new Error("Thời gian đặt bàn nằm ngoài giờ hoạt động");
    }

    const hasConflict = await hasReservationConflict({
      branchId,
      tableId,
      startTime: reservationTime,
      transaction,
    });

    if (hasConflict) {
      throw new Error("Bàn đã được đặt trong thời gian này");
    }

    const validatedCart = await validateAndPriceCart(
      cart,
      branchId,
      transaction
    );

    const userId = req.user?.id ?? null;

    const reservation = await Reservation.create(
      {
        branch_id: branchId,
        table_id: tableId,
        reservation_time: reservationTime,
        end_time: getReservationEndTime(reservationTime),
        customer_name: normalizedName,
        phone: normalizedPhone,
        email: normalizedEmail || null,
        branch: branch.name,
        note: note?.trim() || "",
        guest_count: guestCount,
        user_id: userId,
        status: "pending",
      },
      {
        transaction,
      }
    );

    const order = await createOrderFromCart({
      reservationId: reservation.id,
      branchId,
      userId,
      cart: validatedCart,
      transaction,
    });

    await transaction.commit();
    transaction = null;

    emitReservationEvent(
      "new-reservation",
      branchId,
      {
        id: reservation.id,
        branch_id: branchId,
        table_id: tableId,
        name: normalizedName,
        phone: normalizedPhone,
        time: reservationTime,
        status: "pending",
      }
    );

    const notificationStatus = await sendReservationEmail({
      email: normalizedEmail,
      name: normalizedName,
      branchName: branch.name,
      branchAddress: branch.address,
      reservationTime,
      guestCount,
      phone: normalizedPhone,
    });

    return res.status(201).json({
      message: "Đặt bàn thành công",
      data: {
        reservation,
        order,
        notificationStatus,
      },
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error(
      "CREATE RESERVATION ERROR:",
      error
    );

    return res.status(400).json({
      message: "Không thể tạo đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   GET MY RESERVATIONS
========================================================= */

export const getMyReservations = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const data = await Reservation.findAll({
      where: {
        user_id: req.user.id,
      },
      include: [
        {
          model: TableModel,
          attributes: [
            "id",
            "name",
            "capacity",
            "type",
          ],
        },
        {
          model: Branch,
          as: "restaurantBranch",
          attributes: [
            "id",
            "name",
            "code",
            "address",
          ],
        },
      ],
      order: [
        ["reservation_time", "DESC"],
      ],
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      "GET MY RESERVATIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy lịch đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   GET ALL RESERVATIONS
========================================================= */

export const getAllReservationsAdmin = async (
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

    if (!RESERVATION_VIEW_ROLES.includes(role)) {
      return res.status(403).json({
        message: "Bạn không có quyền xem danh sách đặt bàn",
      });
    }

    const where: WhereOptions = {};

    if (role === "chain_manager") {
      const assignments = await StaffBranch.findAll({
        where: {
          user_id: req.user.id,
          is_active: true,
        },
        attributes: ["branch_id"],
      });

      const branchIds = [
        ...new Set(
          assignments.map((item) => Number(item.branch_id))
        ),
      ];

      if (branchIds.length === 0) {
        return res.status(200).json([]);
      }

      where.branch_id = {
        [Op.in]: branchIds,
      };
    } else if (
      role === "branch_manager" ||
      role === "waiter"
    ) {
      if (!branchId) {
        return res.status(403).json({
          message: "Tài khoản chưa được gán chi nhánh",
        });
      }

      where.branch_id = branchId;
    }

    const data = await Reservation.findAll({
      where,
      include: [
        {
          model: TableModel,
          attributes: [
            "id",
            "name",
            "capacity",
            "type",
          ],
        },
        {
          model: Branch,
          as: "restaurantBranch",
          attributes: [
            "id",
            "name",
            "code",
            "address",
          ],
        },
      ],
      order: [
        ["reservation_time", "DESC"],
      ],
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error(
      "GET ADMIN RESERVATION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể tải danh sách đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   GET RESERVATION BY ID
========================================================= */

export const getReservationById = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const reservation = await Reservation.findByPk(id, {
      include: [
        {
          model: TableModel,
          attributes: [
            "id",
            "name",
            "capacity",
            "type",
          ],
        },
        {
          model: Branch,
          as: "restaurantBranch",
          attributes: [
            "id",
            "name",
            "code",
            "address",
          ],
        },
      ],
    });

    if (!reservation) {
      return res.status(404).json({
        message: "Không tìm thấy đặt bàn",
      });
    }

    let canAccess = false;

    if (isManager(req.user.role)) {
      canAccess = await canManageBranch(
        req.user,
        reservation.branch_id
      );
    } else if (req.user.role === "waiter") {
      canAccess =
        Number(req.user.branchId) ===
        Number(reservation.branch_id);
    } else {
      canAccess =
        reservation.user_id === req.user.id;
    }

    if (!canAccess) {
      return res.status(403).json({
        message: "Bạn không có quyền xem đặt bàn này",
      });
    }

    return res.status(200).json(reservation);
  } catch (error) {
    console.error(
      "GET RESERVATION BY ID ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy thông tin đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   UPDATE RESERVATION
========================================================= */

export const updateReservation = async (
  req: AuthRequest,
  res: Response
) => {
  let transaction: Transaction | null = null;

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    transaction = await sequelize.transaction();

    const reservation = await Reservation.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!reservation) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        message: "Không tìm thấy đặt bàn",
      });
    }

    if (
      !(await canManageBranch(
        req.user,
        reservation.branch_id
      ))
    ) {
      await transaction.rollback();
      transaction = null;

      return res.status(403).json({
        message: "Bạn không có quyền cập nhật đặt bàn này",
      });
    }

    const {
      table_id,
      reservation_time,
      guest_count,
      note,
      status,
    } = req.body as {
      table_id?: number;
      reservation_time?: string | Date;
      guest_count?: number;
      note?: string;
      status?: ReservationStatus;
    };

    if (status !== undefined) {
      await transaction.rollback();
      transaction = null;

      return res.status(400).json({
        message:
          "Vui lòng sử dụng chức năng riêng để thay đổi trạng thái đặt bàn",
      });
    }

    const nextTime =
      reservation_time !== undefined
        ? parseReservationTime(reservation_time)
        : new Date(reservation.reservation_time);

    if (!nextTime) {
      throw new Error("Thời gian đặt bàn không hợp lệ");
    }

    if (isPastReservationTime(nextTime)) {
      throw new Error("Không thể đặt bàn vào thời gian đã qua");
    }

    const targetTableId =
      table_id !== undefined
        ? Number(table_id)
        : reservation.table_id;

    if (!isValidPositiveId(targetTableId)) {
      throw new Error("ID bàn không hợp lệ");
    }

    const targetGuestCount =
      guest_count !== undefined
        ? Number(guest_count)
        : reservation.guest_count;

    if (
      !Number.isInteger(targetGuestCount) ||
      targetGuestCount <= 0 ||
      targetGuestCount > 100
    ) {
      throw new Error("Số khách không hợp lệ");
    }

    const targetTable = await TableModel.findByPk(
      targetTableId,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!targetTable) {
      throw new Error("Không tìm thấy bàn");
    }

    if (
      Number(targetTable.branch_id) !==
      Number(reservation.branch_id)
    ) {
      throw new Error("Bàn không thuộc chi nhánh của đặt bàn");
    }

    if (targetGuestCount > targetTable.capacity) {
      throw new Error(
        `Bàn chỉ phục vụ tối đa ${targetTable.capacity} người`
      );
    }

    const branch = await Branch.findByPk(
      Number(reservation.branch_id),
      {
        transaction,
      }
    );

    if (!branch) {
      throw new Error("Không tìm thấy chi nhánh");
    }

    const timeString = nextTime
      .toTimeString()
      .slice(0, 8);

    if (
      timeString < branch.opening_time ||
      timeString >= branch.closing_time
    ) {
      throw new Error("Thời gian đặt bàn nằm ngoài giờ hoạt động");
    }

    if (targetTable.status === "occupied") {
      throw new Error("Bàn hiện đang có khách sử dụng");
    }

    const hasConflict = await hasReservationConflict({
      branchId: Number(reservation.branch_id),
      tableId: targetTableId,
      startTime: nextTime,
      excludeReservationId: reservation.id,
      transaction,
    });

    if (hasConflict) {
      throw new Error("Bàn đã có đặt bàn trong thời gian này");
    }

    await reservation.update(
      {
        table_id: targetTableId,
        reservation_time: nextTime,
        end_time: getReservationEndTime(nextTime),
        guest_count: targetGuestCount,
        note:
          note !== undefined
            ? String(note).trim()
            : reservation.note,
      },
      {
        transaction,
      }
    );

    await transaction.commit();
    transaction = null;

    emitReservationEvent(
      "reservation-updated",
      reservation.branch_id,
      {
        id: reservation.id,
        branch_id: reservation.branch_id,
        table_id: targetTableId,
        reservation_time: nextTime,
        end_time: getReservationEndTime(nextTime),
        guest_count: targetGuestCount,
      }
    );

    return res.status(200).json({
      message: "Cập nhật đặt bàn thành công",
      data: reservation,
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error(
      "UPDATE RESERVATION ERROR:",
      error
    );

    return res.status(400).json({
      message: "Không thể cập nhật đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   RESERVATION STATUS TRANSITIONS
========================================================= */

const ALLOWED_TRANSITIONS: Record<
  ReservationStatus,
  ReservationStatus[]
> = {
  pending: [
    "confirmed",
    "cancelled",
  ],
  confirmed: [
    "checked_in",
    "cancelled",
  ],
  checked_in: [
    "completed",
  ],
  completed: [],
  cancelled: [],
};

/* =========================================================
   CHANGE RESERVATION STATUS
========================================================= */

const changeReservationStatus = async (
  req: AuthRequest,
  res: Response,
  nextStatus: ReservationStatus
) => {
  let transaction: Transaction | null = null;

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (
      ![
        "admin",
        "chain_manager",
        "branch_manager",
      ].includes(req.user.role)
    ) {
      return res.status(403).json({
        message: "Bạn không có quyền thay đổi trạng thái đặt bàn",
      });
    }

    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    transaction = await sequelize.transaction();

    const reservation = await Reservation.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!reservation) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        message: "Không tìm thấy đặt bàn",
      });
    }

    if (
      !(await canManageBranch(
        req.user,
        reservation.branch_id
      ))
    ) {
      await transaction.rollback();
      transaction = null;

      return res.status(403).json({
        message: "Bạn không có quyền thao tác đặt bàn này",
      });
    }

    const currentStatus =
      reservation.status as ReservationStatus;

    if (
      !ALLOWED_TRANSITIONS[currentStatus]?.includes(
        nextStatus
      )
    ) {
      throw new Error(
        `Không thể chuyển từ "${currentStatus}" sang "${nextStatus}"`
      );
    }

    const table = await TableModel.findByPk(
      reservation.table_id,
      {
        transaction,
        lock: transaction.LOCK.UPDATE,
      }
    );

    if (!table) {
      throw new Error("Không tìm thấy bàn của đặt bàn");
    }

    await reservation.update(
      {
        status: nextStatus,
      },
      {
        transaction,
      }
    );

    if (nextStatus === "checked_in") {
      await table.update(
        {
          status: "occupied",
        },
        {
          transaction,
        }
      );
    }

    if (
      nextStatus === "completed" ||
      nextStatus === "cancelled"
    ) {
      const anotherActiveReservation =
        await Reservation.findOne({
          where: {
            id: {
              [Op.ne]: reservation.id,
            },
            branch_id: reservation.branch_id,
            table_id: reservation.table_id,
            status: {
              [Op.in]: [
                "checked_in",
              ],
            },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

      if (!anotherActiveReservation) {
        await table.update(
          {
            status: "available",
          },
          {
            transaction,
          }
        );
      }
    }

    await transaction.commit();
    transaction = null;

    emitReservationEvent(
      "reservation-status-updated",
      reservation.branch_id,
      {
        id: reservation.id,
        branch_id: reservation.branch_id,
        table_id: reservation.table_id,
        status: nextStatus,
      }
    );

    return res.status(200).json({
      message: "Cập nhật trạng thái thành công",
      data: reservation,
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error(
      "CHANGE RESERVATION STATUS ERROR:",
      error
    );

    return res.status(400).json({
      message: "Không thể cập nhật trạng thái đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   CONFIRM
========================================================= */

export const confirmReservation = async (
  req: AuthRequest,
  res: Response
) => {
  return changeReservationStatus(
    req,
    res,
    "confirmed"
  );
};

/* =========================================================
   CHECK-IN
========================================================= */

export const checkInReservation = async (
  req: AuthRequest,
  res: Response
) => {
  return changeReservationStatus(
    req,
    res,
    "checked_in"
  );
};

/* =========================================================
   COMPLETE
========================================================= */

export const completeReservation = async (
  req: AuthRequest,
  res: Response
) => {
  return changeReservationStatus(
    req,
    res,
    "completed"
  );
};

/* =========================================================
   CANCEL
========================================================= */

export const cancelReservation = async (
  req: AuthRequest,
  res: Response
) => {
  return changeReservationStatus(
    req,
    res,
    "cancelled"
  );
};

/* =========================================================
   DELETE RESERVATION
   Chỉ Admin được xóa.
========================================================= */

export const deleteReservation = async (
  req: AuthRequest,
  res: Response
) => {
  let transaction: Transaction | null = null;

  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "Chỉ Admin mới được xóa đặt bàn",
      });
    }

    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    transaction = await sequelize.transaction();

    const reservation = await Reservation.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!reservation) {
      await transaction.rollback();
      transaction = null;

      return res.status(404).json({
        message: "Không tìm thấy đặt bàn",
      });
    }

    await reservation.destroy({
      transaction,
    });

    await transaction.commit();
    transaction = null;

    emitReservationEvent(
      "reservation-deleted",
      reservation.branch_id,
      {
        id: reservation.id,
        branch_id: reservation.branch_id,
      }
    );

    return res.status(200).json({
      message: "Xóa đặt bàn thành công",
    });
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }

    console.error(
      "DELETE RESERVATION ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể xóa đặt bàn",
      error: getErrorMessage(error),
    });
  }
};
