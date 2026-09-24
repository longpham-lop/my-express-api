import { Request, Response } from "express";
import Reservation from "../models/Reservation";
import TableModel from "../models/Table";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import Branch from "../models/Branch";
import OtpRequest from "../models/OtpRequest";
import bcrypt from "bcryptjs";
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
  price: number;
  quantity: number;
}

/* =========================================================
   CONSTANTS
========================================================= */

const ADMIN_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const MANAGER_ROLES = [
  "admin",
  "chain_manager",
  "branch_manager",
];

const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
];

/* =========================================================
   HELPERS
========================================================= */

const isManager = (role?: string) => {
  return !!role && MANAGER_ROLES.includes(role);
};

const canManageBranch = (
  user: AuthUser,
  branchId: number | null | undefined
) => {
  if (branchId == null) {
    return false;
  }

  if (
    user.role === "admin" ||
    user.role === "chain_manager"
  ) {
    return true;
  }

  if (user.role === "branch_manager") {
    return user.branchId === branchId;
  }

  return false;
};

const parseId = (
  value: string | string[] | undefined
) => {
  const rawValue = Array.isArray(value)
    ? value[0]
    : value;

  if (typeof rawValue !== "string") {
    return null;
  }

  const id = Number(rawValue);

  return Number.isInteger(id) && id > 0
    ? id
    : null;
};

const parseReservationTime = (
  value: unknown
): Date | null => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? null
      : value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error
    ? error.message
    : "Unknown error";
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

    if (!Number.isInteger(branchId)) {
      return res.status(400).json({
        message: "Chi nhánh không hợp lệ",
      });
    }

    if (!start_time) {
      return res.status(400).json({
        message: "Vui lòng chọn thời gian đặt bàn",
      });
    }

    if (
      !Number.isInteger(guestCount) ||
      guestCount <= 0
    ) {
      return res.status(400).json({
        message: "Số khách không hợp lệ",
      });
    }

    /* =====================================================
       1. KIỂM TRA CHI NHÁNH
    ===================================================== */

    const branch =
      await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message: "Không tìm thấy chi nhánh",
      });
    }

    if (branch.status !== "active") {
      return res.status(400).json({
        message: "Chi nhánh hiện không hoạt động",
      });
    }

    if (!branch.is_accepting_reservations) {
      return res.status(400).json({
        message:
          "Chi nhánh hiện không nhận đặt bàn",
      });
    }

    /* =====================================================
       2. KIỂM TRA GIỜ HOẠT ĐỘNG
    ===================================================== */

    const date = new Date(start_time);

    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    const timeString = date
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

    /* =====================================================
       3. LẤY TẤT CẢ BÀN CỦA CHI NHÁNH
    ===================================================== */

    const tables =
      await TableModel.findAll({
        where: {
          branch_id: branchId,
        },
        order: [
          ["capacity", "ASC"],
          ["id", "ASC"],
        ],
      });

    /* =====================================================
       4. LỌC BÀN ĐỦ SỨC CHỨA
    ===================================================== */

    const suitableTables =
      tables.filter(
        (table) =>
          table.capacity >= guestCount
      );

    if (suitableTables.length === 0) {
      return res.status(200).json({
        message:
          "Không có bàn phù hợp với số lượng khách",
        data: [],
      });
    }

    /* =====================================================
       5. LẤY RESERVATION ĐANG ACTIVE
    ===================================================== */

    const reservations =
      await Reservation.findAll({
        where: {
          branch_id: branchId,
          reservation_time: start_time,
          status:
            ACTIVE_RESERVATION_STATUSES,
        },
      });

    const reservedTableIds =
      new Set(
        reservations.map(
          (reservation) =>
            reservation.table_id
        )
      );

    /* =====================================================
       6. LỌC BÀN ĐANG TRỐNG
    ===================================================== */

    const availableTables =
      suitableTables.filter(
        (table) =>
          !reservedTableIds.has(
            table.id
          ) &&
          table.status !== "occupied"
      );

    /* =====================================================
       7. RESPONSE
    ===================================================== */

    return res.status(200).json({
      message:
        availableTables.length > 0
          ? "Tìm thấy bàn phù hợp"
          : "Không còn bàn phù hợp",
      data: availableTables.map(
        (table) => ({
          id: table.id,
          name: table.name,
          capacity: table.capacity,
          type: table.type,
        })
      ),
    });
  } catch (error) {
    console.error(
      "CHECK RESERVATION AVAILABILITY ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể kiểm tra bàn trống",
      error: getErrorMessage(error),
    });
  }
};
/* =========================================================
   REQUEST RESERVATION OTP
========================================================= */

export const requestReservationOtp = async (
  req: Request,
  res: Response
) => {
  try {
    const { phone } = req.body as {
      phone?: string;
    };

    const normalizedPhone =
      String(phone || "").trim();

    if (!normalizedPhone) {
      return res.status(400).json({
        message: "Vui lòng nhập số điện thoại",
      });
    }

    /*
     * Kiểm tra số điện thoại cơ bản
     */
    const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;

    if (!phoneRegex.test(normalizedPhone)) {
      return res.status(400).json({
        message: "Số điện thoại không hợp lệ",
      });
    }

    /*
     * Tạo mã OTP 6 số
     */
    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    /*
     * Hash OTP trước khi lưu DB
     */
    const codeHash = await bcrypt.hash(
      code,
      10
    );

    /*
     * OTP có hiệu lực 5 phút
     */
    const expiresAt = new Date(
      Date.now() + 5 * 60 * 1000
    );

    /*
     * Tạo request OTP
     */
    const otpRequest =
      await OtpRequest.create({
        phone: normalizedPhone,
        purpose: "reservation",
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        max_attempts: 5,
      });

    /*
     * =====================================================
     * DEVELOPMENT MODE
     *
     * Trả code để test local.
     * Khi deploy production thì KHÔNG trả debug_code.
     * =====================================================
     */

    return res.status(200).json({
      message: "Đã gửi mã OTP",
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
      message: "Không thể gửi mã OTP",
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
    } = req.body as {
      branch_id?: number;
      table_id?: number;
      start_time?: string;
      guest_count?: number;
      name?: string;
      phone?: string;
      email?: string;
      note?: string;
      otp_request_id?: number;
      otp_code?: string;
    };

    const branchId = Number(branch_id);
    const tableId = Number(table_id);
    const guestCount = Number(guest_count);
    const otpRequestId = Number(
      otp_request_id
    );

    /*
     * =====================================================
     * 1. VALIDATE INPUT
     * =====================================================
     */

    if (
      !Number.isInteger(branchId) ||
      branchId <= 0
    ) {
      return res.status(400).json({
        message: "Chi nhánh không hợp lệ",
      });
    }

    if (
      !Number.isInteger(tableId) ||
      tableId <= 0
    ) {
      return res.status(400).json({
        message: "Bàn không hợp lệ",
      });
    }

    if (!start_time) {
      return res.status(400).json({
        message:
          "Vui lòng chọn thời gian đặt bàn",
      });
    }

    if (
      !Number.isInteger(guestCount) ||
      guestCount <= 0
    ) {
      return res.status(400).json({
        message: "Số khách không hợp lệ",
      });
    }

    if (!name?.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập họ tên",
      });
    }

    if (!phone?.trim()) {
      return res.status(400).json({
        message:
          "Vui lòng nhập số điện thoại",
      });
    }

    if (
      !Number.isInteger(otpRequestId) ||
      otpRequestId <= 0
    ) {
      return res.status(400).json({
        message: "Yêu cầu OTP không hợp lệ",
      });
    }

    if (!otp_code?.trim()) {
      return res.status(400).json({
        message: "Vui lòng nhập mã OTP",
      });
    }

    /*
     * =====================================================
     * 2. TÌM OTP REQUEST
     * =====================================================
     */

    const otpRequest =
      await OtpRequest.findOne({
        where: {
          id: otpRequestId,
          phone: phone.trim(),
          purpose: "reservation",
        },
      });

    if (!otpRequest) {
      return res.status(400).json({
        message:
          "Mã OTP không tồn tại hoặc không hợp lệ",
      });
    }

    /*
     * =====================================================
     * 3. KIỂM TRA OTP ĐÃ XÁC THỰC
     * =====================================================
     */

    if (otpRequest.verified_at) {
      return res.status(400).json({
        message:
          "Mã OTP này đã được sử dụng",
      });
    }

    /*
     * =====================================================
     * 4. KIỂM TRA HẾT HẠN
     * =====================================================
     */

    if (
      new Date() >
      new Date(otpRequest.expires_at)
    ) {
      return res.status(400).json({
        message:
          "Mã OTP đã hết hạn, vui lòng lấy mã mới",
      });
    }

    /*
     * =====================================================
     * 5. KIỂM TRA SỐ LẦN NHẬP
     * =====================================================
     */

    if (
      otpRequest.attempts >=
      otpRequest.max_attempts
    ) {
      return res.status(400).json({
        message:
          "Bạn đã nhập sai OTP quá số lần cho phép",
      });
    }

    /*
     * =====================================================
     * 6. SO SÁNH OTP
     * =====================================================
     */

    const isValidOtp =
      await bcrypt.compare(
        otp_code.trim(),
        otpRequest.code_hash
      );

    if (!isValidOtp) {
      await otpRequest.increment(
        "attempts"
      );

      return res.status(400).json({
        message: "Mã OTP không chính xác",
      });
    }

    /*
     * =====================================================
     * 7. TÌM CHI NHÁNH
     * =====================================================
     */

    const branch =
      await Branch.findByPk(branchId);

    if (!branch) {
      return res.status(404).json({
        message:
          "Không tìm thấy chi nhánh",
      });
    }

    if (branch.status !== "active") {
      return res.status(400).json({
        message:
          "Chi nhánh hiện không hoạt động",
      });
    }

    if (!branch.is_accepting_reservations) {
      return res.status(400).json({
        message:
          "Chi nhánh hiện không nhận đặt bàn",
      });
    }

    /*
     * =====================================================
     * 8. KIỂM TRA BÀN
     * =====================================================
     */

    const table =
      await TableModel.findByPk(tableId);

    if (!table) {
      return res.status(404).json({
        message: "Không tìm thấy bàn",
      });
    }

    if (table.branch_id !== branchId) {
      return res.status(400).json({
        message:
          "Bàn không thuộc chi nhánh đã chọn",
      });
    }

    if (guestCount > table.capacity) {
      return res.status(400).json({
        message:
          `Bàn chỉ phục vụ tối đa ${table.capacity} người`,
      });
    }

    /*
     * =====================================================
     * 9. KIỂM TRA THỜI GIAN
     * =====================================================
     */

    const reservationTime =
      parseReservationTime(start_time);

    if (!reservationTime) {
      return res.status(400).json({
        message:
          "Thời gian đặt bàn không hợp lệ",
      });
    }

    /*
     * =====================================================
     * 10. KIỂM TRA TRÙNG BÀN
     * =====================================================
     */

    const existing =
      await Reservation.findOne({
        where: {
          table_id: tableId,
          reservation_time:
            reservationTime,
          status:
            ACTIVE_RESERVATION_STATUSES,
        },
      });

    if (existing) {
      return res.status(409).json({
        message:
          "Bàn vừa được khách khác đặt",
      });
    }

    /*
     * =====================================================
     * 11. ĐÁNH DẤU OTP ĐÃ XÁC THỰC
     * =====================================================
     */

    await otpRequest.update({
      verified_at: new Date(),
    });

    /*
     * =====================================================
     * 12. TẠO RESERVATION
     * =====================================================
     */

    const reservation =
      await Reservation.create({
        branch_id: branchId,
        table_id: tableId,
        reservation_time:
          reservationTime,
        customer_name:
          name.trim(),
        phone: phone.trim(),
        email: email?.trim() || "",
        branch: branch.name,
        note: note?.trim() || "",
        guest_count: guestCount,
        status: "pending",
      });

    /*
     * =====================================================
     * 13. REALTIME
     * =====================================================
     */

    try {
      const io = getIO();

      io.emit("new-reservation", {
        id: reservation.id,
        branch_id:
          reservation.branch_id,
        table_id:
          reservation.table_id,
        name:
          reservation.customer_name,
        phone:
          reservation.phone,
        time:
          reservation.reservation_time,
        status:
          reservation.status,
      });
    } catch (socketError) {
      console.warn(
        "SOCKET ONLINE RESERVATION WARNING:",
        socketError
      );
    }

    /*
     * =====================================================
     * 14. EMAIL XÁC NHẬN
     * =====================================================
     */

    let notificationStatus:
      | "sent"
      | "skipped"
      | "failed" = "skipped";

    if (
      email &&
      isEmailDeliveryConfigured()
    ) {
      try {
        await sgMail.send({
          to: email,
          from:
            process.env.SENDGRID_FROM_EMAIL ||
            "",
          subject:
            "Xác nhận đặt bàn",
          text: `
Xin chào ${name},

Bạn đã đặt bàn thành công!

Chi nhánh: ${branch.name}
Địa chỉ: ${branch.address}
Thời gian: ${start_time}
Số khách: ${guestCount}
Số điện thoại: ${phone}

Vui lòng đến đúng giờ và báo tên hoặc số điện thoại cho nhân viên.
          `,
        });

        notificationStatus = "sent";
      } catch (emailError) {
        notificationStatus = "failed";

        console.error(
          "ONLINE RESERVATION EMAIL FAILED:",
          emailError
        );
      }
    }

    return res.status(201).json({
      message:
        "Xác nhận đặt bàn thành công",
      data: {
        reservation,
        notificationStatus,
      },
    });
  } catch (error) {
    console.error(
      "CREATE ONLINE RESERVATION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể tạo đặt bàn",
      error: getErrorMessage(error),
    });
  }
};
/* =========================================================
   CREATE RESERVATION
========================================================= */

export const createReservation = async (
  req: AuthRequest,
  res: Response
) => {
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
    } = req.body as {
      table_id?: number;
      reservation_time?: string | Date;
      name?: string;
      phone?: string;
      email?: string;
      note?: string;
      cart?: CartItem[];
      guest_count?: number;
    };

    const parsedReservationTime =
      parseReservationTime(reservation_time);

    if (
      !table_id ||
      !parsedReservationTime ||
      !name ||
      !phone
    ) {
      return res.status(400).json({
        message:
          "Thiếu thông tin bắt buộc để đặt bàn",
      });
    }

    const tableId = Number(table_id);
    const guestCount = Number(guest_count);

    if (!Number.isInteger(tableId)) {
      return res.status(400).json({
        message: "ID bàn không hợp lệ",
      });
    }

    if (
      !Number.isInteger(guestCount) ||
      guestCount <= 0
    ) {
      return res.status(400).json({
        message:
          "Số lượng khách phải lớn hơn 0",
      });
    }

    /* =====================================================
       1. KIỂM TRA BÀN
    ===================================================== */

    const table = await TableModel.findByPk(tableId);

    if (!table) {
      return res.status(404).json({
        message: "Bàn không tồn tại",
      });
    }

    if (!table.branch_id) {
      return res.status(400).json({
        message:
          "Bàn chưa được gán chi nhánh",
      });
    }

    if (guestCount > table.capacity) {
      return res.status(400).json({
        message:
          `Bàn chỉ phục vụ tối đa ${table.capacity} người`,
      });
    }

    /* =====================================================
       2. KIỂM TRA CHI NHÁNH
    ===================================================== */

    const branch = await Branch.findByPk(
      table.branch_id
    );

    if (!branch) {
      return res.status(404).json({
        message:
          "Chi nhánh của bàn không tồn tại",
      });
    }

    if (branch.status !== "active") {
      return res.status(400).json({
        message:
          "Chi nhánh hiện không hoạt động",
      });
    }

    if (!branch.is_accepting_reservations) {
      return res.status(400).json({
        message:
          "Chi nhánh hiện không nhận đặt bàn",
      });
    }

    /* =====================================================
       3. KIỂM TRA TRÙNG LỊCH
    ===================================================== */

    const existing = await Reservation.findOne({
      where: {
        table_id: tableId,
        reservation_time: parsedReservationTime,
        status: ACTIVE_RESERVATION_STATUSES,
      },
    });

    if (existing) {
      return res.status(409).json({
        message:
          "Bàn đã được đặt trong thời gian này",
      });
    }

    /* =====================================================
       4. TẠO RESERVATION
    ===================================================== */

    const userId = req.user?.id;

    const reservation =
      await Reservation.create({
        branch_id: table.branch_id,
        table_id: tableId,
        reservation_time: parsedReservationTime,
        customer_name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || "",
        branch: branch.name,
        note: note?.trim() || "",
        guest_count: guestCount,
        user_id: userId,
        status: "pending",
      });

    /* =====================================================
       5. TẠO ORDER NẾU CÓ CART
    ===================================================== */

    let order: Order | null = null;

    if (
      Array.isArray(cart) &&
      cart.length > 0
    ) {
      const total = cart.reduce(
        (sum, item) => {
          const price = Number(item.price);
          const quantity = Number(item.quantity);

          if (
            !Number.isFinite(price) ||
            !Number.isFinite(quantity)
          ) {
            return sum;
          }

          return sum + price * quantity;
        },
        0
      );

      order = await Order.create({
        branch_id: table.branch_id,
        reservation_id: reservation.id,
        user_id: userId,
        total_price: total,
        status: "pending",
      });

      const orderItems = cart.map(
        (item) => ({
          order_id: order!.id,
          menu_item_id: Number(item.id),
          quantity: Number(item.quantity),
          unit_price: Number(item.price),
        })
      );

      await OrderItem.bulkCreate(
        orderItems
      );
    }

    /* =====================================================
       6. REALTIME
    ===================================================== */

    try {
      const io = getIO();

      io.emit("new-reservation", {
        id: reservation.id,
        branch_id: reservation.branch_id,
        table_id: reservation.table_id,
        name: reservation.customer_name,
        phone: reservation.phone,
        time: reservation.reservation_time,
        status: reservation.status,
      });
    } catch (socketError) {
      console.warn(
        "SOCKET EMIT RESERVATION WARNING:",
        socketError
      );
    }

    /* =====================================================
       7. EMAIL
    ===================================================== */

    let notificationStatus:
      | "sent"
      | "skipped"
      | "failed" = "skipped";

    if (email) {
      const msg = {
        to: email,
        from:
          process.env.SENDGRID_FROM_EMAIL || "",
        subject: "Xác nhận đặt bàn",
        text: `
Xin chào ${name},

Bạn đã đặt bàn thành công!

Cơ sở: ${branch.name}
Địa chỉ: ${branch.address}
Thời gian: ${reservation_time}
Số khách: ${guestCount}
Số điện thoại: ${phone}

Khi đến nhà hàng, vui lòng báo tên hoặc số điện thoại cho nhân viên.
        `,
      };

      if (isEmailDeliveryConfigured()) {
        try {
          await sgMail.send(msg);
          notificationStatus = "sent";
        } catch (emailError) {
          notificationStatus = "failed";

          console.error(
            "RESERVATION EMAIL FAILED:",
            emailError
          );
        }
      }
    }

    return res.status(201).json({
      message: "Đặt bàn thành công",
      data: {
        reservation,
        order,
        notificationStatus,
      },
    });
  } catch (error) {
    console.error(
      "CREATE RESERVATION ERROR:",
      error
    );

    return res.status(500).json({
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

    const data =
      await Reservation.findAll({
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

    return res.json(data);
  } catch (error) {
    console.error(
      "GET MY RESERVATIONS ERROR:",
      error
    );

    return res.status(500).json({
      message: "Không thể lấy lịch đặt bàn",
    });
  }
};

/* =========================================================
   ADMIN GET ALL
========================================================= */

export const getAllReservationsAdmin = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // =====================================================
    // 1. BẮT BUỘC ĐĂNG NHẬP
    // =====================================================

    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    const {
      role,
      branchId,
    } = req.user;

    // =====================================================
    // 2. CHỈ CÁC ROLE ĐƯỢC PHÉP XEM RESERVATION ADMIN
    // =====================================================

    const allowedRoles = [
      "admin",
      "chain_manager",
      "branch_manager",
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem danh sách đặt bàn",
      });
    }

    // =====================================================
    // 3. BRANCH MANAGER PHẢI CÓ CHI NHÁNH
    // =====================================================

    if (
      role === "branch_manager" &&
      !branchId
    ) {
      return res.status(403).json({
        message:
          "Tài khoản quản lý chi nhánh chưa được gán chi nhánh",
      });
    }

    // =====================================================
    // 4. TẠO ĐIỀU KIỆN QUERY
    // =====================================================

    const where: {
      branch_id?: number;
    } = {};

    // -----------------------------------------------------
    // ADMIN / CHAIN MANAGER
    // → xem toàn hệ thống
    // -----------------------------------------------------

    if (
      role === "admin" ||
      role === "chain_manager"
    ) {
      // Không thêm branch_id
      // => xem tất cả chi nhánh
    }

    // -----------------------------------------------------
    // BRANCH MANAGER
    // → CHỈ branch của mình
    // -----------------------------------------------------

    if (
      role === "branch_manager"
    ) {
      where.branch_id =
        branchId as number;
    }

    // =====================================================
    // 5. LẤY RESERVATION
    // =====================================================

    const data =
      await Reservation.findAll({
        where,

        include: [
          {
            model: TableModel,
            attributes: [
              "id",
              "name",
              "capacity",
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
          [
            "reservation_time",
            "DESC",
          ],
        ],
      });

    // =====================================================
    // 6. TRẢ DATA
    // =====================================================

    return res.status(200).json(data);

  } catch (err: unknown) {
    console.error(
      "GET ADMIN RESERVATION ERROR:",
      err
    );

    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";

    return res.status(500).json({
      message:
        "Không thể tải danh sách đặt bàn",
      error: message,
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

    const reservation =
      await Reservation.findByPk(id, {
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
        message:
          "Không tìm thấy đặt bàn",
      });
    }

    const canAccess =
      isManager(req.user.role)
        ? canManageBranch(
            req.user,
            reservation.branch_id
          )
        : reservation.user_id ===
          req.user.id;

    if (!canAccess) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xem đặt bàn này",
      });
    }

    return res.json(reservation);
  } catch (error) {
    console.error(
      "GET RESERVATION BY ID ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể lấy thông tin đặt bàn",
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

    const reservation =
      await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message:
          "Không tìm thấy đặt bàn",
      });
    }

    if (
      !canManageBranch(
        req.user,
        reservation.branch_id
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền cập nhật đặt bàn này",
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

    /* =====================================================
       VALIDATE STATUS
    ===================================================== */

    const validStatuses: ReservationStatus[] = [
      "pending",
      "confirmed",
      "checked_in",
      "completed",
      "cancelled",
    ];

    if (
      status !== undefined &&
      !validStatuses.includes(status)
    ) {
      return res.status(400).json({
        message:
          "Trạng thái đặt bàn không hợp lệ",
      });
    }

    const nextReservationTime =
      reservation_time !== undefined
        ? parseReservationTime(reservation_time)
        : null;

    if (
      reservation_time !== undefined &&
      !nextReservationTime
    ) {
      return res.status(400).json({
        message: "Thời gian đặt bàn không hợp lệ",
      });
    }

    /* =====================================================
       TABLE
    ===================================================== */

    let targetTableId =
      reservation.table_id;

    if (table_id !== undefined) {
      const newTableId = Number(table_id);

      if (!Number.isInteger(newTableId)) {
        return res.status(400).json({
          message: "ID bàn không hợp lệ",
        });
      }

      const newTable =
        await TableModel.findByPk(
          newTableId
        );

      if (!newTable) {
        return res.status(404).json({
          message:
            "Không tìm thấy bàn mới",
        });
      }

      if (
        newTable.branch_id !==
        reservation.branch_id
      ) {
        return res.status(400).json({
          message:
            "Bàn không thuộc chi nhánh của đặt bàn",
        });
      }

      targetTableId = newTableId;
    }

    /* =====================================================
       GUEST COUNT
    ===================================================== */

    let targetGuestCount =
      reservation.guest_count;

    if (guest_count !== undefined) {
      const value = Number(guest_count);

      if (
        !Number.isInteger(value) ||
        value <= 0
      ) {
        return res.status(400).json({
          message:
            "Số khách không hợp lệ",
        });
      }

      targetGuestCount = value;
    }

    const targetTable =
      await TableModel.findByPk(
        targetTableId
      );

    if (!targetTable) {
      return res.status(404).json({
        message:
          "Không tìm thấy bàn",
      });
    }

    if (
      targetGuestCount >
      targetTable.capacity
    ) {
      return res.status(400).json({
        message:
          `Bàn chỉ phục vụ tối đa ${targetTable.capacity} người`,
      });
    }

    /* =====================================================
       CHECK TRÙNG LỊCH NẾU ĐỔI BÀN/GIỜ
    ===================================================== */

    if (
      table_id !== undefined ||
      reservation_time !== undefined
    ) {
      const existing =
        await Reservation.findOne({
          where: {
            table_id: targetTableId,
            reservation_time:
              nextReservationTime ??
              reservation.reservation_time,
            status:
              ACTIVE_RESERVATION_STATUSES,
          },
        });

      if (
        existing &&
        existing.id !== reservation.id
      ) {
        return res.status(409).json({
          message:
            "Bàn đã có đặt bàn trong thời gian này",
        });
      }
    }

    /* =====================================================
       UPDATE
    ===================================================== */

    await reservation.update({
      table_id: targetTableId,
      reservation_time:
        nextReservationTime ??
        reservation.reservation_time,
      guest_count: targetGuestCount,
      note:
        note !== undefined
          ? String(note).trim()
          : reservation.note,
      status:
        status ?? reservation.status,
    });

    /* =====================================================
       ĐỒNG BỘ TRẠNG THÁI BÀN
    ===================================================== */

    if (status === "checked_in") {
      await targetTable.update({
        status: "occupied",
      });
    }

    if (
      status === "completed" ||
      status === "cancelled"
    ) {
      await targetTable.update({
        status: "available",
      });
    }

    return res.json({
      message:
        "Cập nhật đặt bàn thành công",
      data: reservation,
    });
  } catch (error) {
    console.error(
      "UPDATE RESERVATION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể cập nhật đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   CONFIRM RESERVATION
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
   CHANGE STATUS HELPER
========================================================= */

const changeReservationStatus = async (
  req: AuthRequest,
  res: Response,
  nextStatus: ReservationStatus
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

    const reservation =
      await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message:
          "Không tìm thấy đặt bàn",
      });
    }

    if (
      !canManageBranch(
        req.user,
        reservation.branch_id
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền thao tác đặt bàn này",
      });
    }

    const currentStatus =
      reservation.status as ReservationStatus;

    /* =====================================================
       KIỂM TRA CHUYỂN TRẠNG THÁI
    ===================================================== */

    const allowedTransitions: Record<
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

    if (
      !allowedTransitions[
        currentStatus
      ].includes(nextStatus)
    ) {
      return res.status(400).json({
        message:
          `Không thể chuyển từ "${currentStatus}" sang "${nextStatus}"`,
      });
    }

    await reservation.update({
      status: nextStatus,
    });

    /* =====================================================
       ĐỒNG BỘ BÀN
    ===================================================== */

    const table =
      await TableModel.findByPk(
        reservation.table_id
      );

    if (table) {
      if (nextStatus === "checked_in") {
        await table.update({
          status: "occupied",
        });
      }

      if (
        nextStatus === "completed" ||
        nextStatus === "cancelled"
      ) {
        await table.update({
          status: "available",
        });
      }
    }

    /* =====================================================
       REALTIME
    ===================================================== */

    try {
      const io = getIO();

      io.emit(
        "reservation-status-updated",
        {
          id: reservation.id,
          branch_id:
            reservation.branch_id,
          table_id:
            reservation.table_id,
          status: nextStatus,
        }
      );
    } catch (socketError) {
      console.warn(
        "SOCKET RESERVATION STATUS WARNING:",
        socketError
      );
    }

    return res.json({
      message:
        "Cập nhật trạng thái thành công",
      data: reservation,
    });
  } catch (error) {
    console.error(
      "CHANGE RESERVATION STATUS ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể cập nhật trạng thái đặt bàn",
      error: getErrorMessage(error),
    });
  }
};

/* =========================================================
   DELETE
========================================================= */

export const deleteReservation = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        message: "Chưa đăng nhập",
      });
    }

    if (
      !ADMIN_ROLES.includes(req.user.role)
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa đặt bàn",
      });
    }

    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "ID không hợp lệ",
      });
    }

    const reservation =
      await Reservation.findByPk(id);

    if (!reservation) {
      return res.status(404).json({
        message:
          "Không tìm thấy đặt bàn",
      });
    }

    if (
      !canManageBranch(
        req.user,
        reservation.branch_id
      )
    ) {
      return res.status(403).json({
        message:
          "Bạn không có quyền xóa đặt bàn của chi nhánh khác",
      });
    }

    await reservation.destroy();

    return res.json({
      message:
        "Xóa đặt bàn thành công",
    });
  } catch (error) {
    console.error(
      "DELETE RESERVATION ERROR:",
      error
    );

    return res.status(500).json({
      message:
        "Không thể xóa đặt bàn",
      error: getErrorMessage(error),
    });
  }
};