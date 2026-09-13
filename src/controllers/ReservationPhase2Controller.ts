import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import { Request, Response } from "express";
import { Op, Transaction } from "sequelize";
import sequelize from "../config/db";
import { Branch, BranchSetting, Customer, OtpRequest, Reservation, Table } from "../models";

const ACTIVE_RESERVATION_STATUSES = ["pending", "confirmed", "checked_in"];
const OTP_TTL_MINUTES = 5;
const MAX_OTP_REQUESTS_PER_15_MINUTES = 3;

const normalizePhone = (phone: unknown) => String(phone || "").replace(/[\s().-]/g, "");
const validPhone = (phone: string) => /^\+?[0-9]{9,15}$/.test(phone);

function parseFutureDate(value: unknown): Date | null {
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) || date <= new Date() ? null : date;
}

function minutesOfDay(value: string) {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

function isInsideOperatingHours(start: Date, end: Date, openingTime: string, closingTime: string) {
  const timeZone = process.env.BUSINESS_TIMEZONE || "Asia/Ho_Chi_Minh";
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const getMinutes = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
    const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
    return hour * 60 + minute;
  };
  const startMinutes = getMinutes(start);
  const endMinutes = getMinutes(end);
  const getDateKey = (date: Date) => formatter.formatToParts(date).filter((part) => ["year", "month", "day"].includes(part.type)).map((part) => part.value).join("-");
  const opening = minutesOfDay(openingTime);
  const closing = minutesOfDay(closingTime);
  // The current MVP supports a same-day operating window; overnight branches can
  // be configured in the next iteration with an explicit timezone/overnight flag.
  return opening < closing && getDateKey(start) === getDateKey(end) && startMinutes >= opening && endMinutes <= closing;
}

async function getBranchAndWindow(branchId: number, startValue: unknown) {
  const [branch, settings] = await Promise.all([
    Branch.findByPk(branchId),
    BranchSetting.findOne({ where: { branch_id: branchId } }),
  ]);
  const start = parseFutureDate(startValue);
  if (!branch || branch.status !== "active" || !branch.is_accepting_reservations || !start) return null;
  const duration = settings?.default_table_duration_minutes || 120;
  const end = new Date(start.getTime() + duration * 60_000);
  if (!isInsideOperatingHours(start, end, branch.opening_time, branch.closing_time)) return null;
  return { branch, settings, start, end };
}

async function findAvailableTables(branchId: number, start: Date, end: Date, guestCount: number) {
  const unavailable = await Reservation.findAll({
    attributes: ["table_id"],
    where: {
      branch_id: branchId,
      status: { [Op.in]: ACTIVE_RESERVATION_STATUSES },
      reservation_time: { [Op.lt]: end },
      end_time: { [Op.gt]: start },
    },
    raw: true,
  });
  const unavailableIds = unavailable.map((item: any) => item.table_id);
  return Table.findAll({
    where: {
      branch_id: branchId,
      capacity: { [Op.gte]: guestCount },
      status: { [Op.ne]: "occupied" },
      ...(unavailableIds.length ? { id: { [Op.notIn]: unavailableIds } } : {}),
    },
    order: [["capacity", "ASC"], ["name", "ASC"]],
  });
}

export const checkAvailability = async (req: Request, res: Response) => {
  const branchId = Number(req.body.branch_id);
  const guestCount = Number(req.body.guest_count);
  if (!Number.isInteger(branchId) || !Number.isInteger(guestCount) || guestCount < 1) {
    return res.status(400).json({ message: "branch_id và guest_count phải hợp lệ" });
  }
  const window = await getBranchAndWindow(branchId, req.body.start_time);
  if (!window) return res.status(400).json({ message: "Chi nhánh không nhận đặt bàn hoặc thời gian không hợp lệ" });
  const tables = await findAvailableTables(branchId, window.start, window.end, guestCount);
  return res.json({
    data: {
      start_time: window.start,
      end_time: window.end,
      duration_minutes: window.settings?.default_table_duration_minutes || 120,
      recommended_table_id: tables[0]?.id || null,
      tables,
    },
  });
};

export const requestReservationOtp = async (req: Request, res: Response) => {
  const phone = normalizePhone(req.body.phone);
  if (!validPhone(phone)) return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
  const since = new Date(Date.now() - 15 * 60_000);
  const recentCount = await OtpRequest.count({ where: { phone, purpose: "reservation", createdAt: { [Op.gte]: since } } });
  if (recentCount >= MAX_OTP_REQUESTS_PER_15_MINUTES) {
    return res.status(429).json({ message: "Bạn đã yêu cầu mã quá nhiều lần. Vui lòng thử lại sau 15 phút." });
  }
  const code = randomInt(100000, 1_000_000).toString();
  const otp = await OtpRequest.create({
    phone,
    purpose: "reservation",
    code_hash: await bcrypt.hash(code, 10),
    expires_at: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
  });
  return res.status(201).json({
    data: {
      otp_request_id: otp.id,
      expires_at: otp.expires_at,
      ...(process.env.NODE_ENV !== "production" ? { debug_code: code } : {}),
    },
  });
};

async function verifyOtp(otpId: number, phone: string, code: string, transaction: Transaction) {
  const otp = await OtpRequest.findByPk(otpId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!otp || otp.purpose !== "reservation" || otp.phone !== phone) throw new Error("OTP_NOT_FOUND");
  if (otp.verified_at || otp.expires_at <= new Date()) throw new Error("OTP_EXPIRED");
  if (otp.attempts >= otp.max_attempts) throw new Error("OTP_LOCKED");
  const valid = await bcrypt.compare(code, otp.code_hash);
  if (!valid) {
    await otp.update({ attempts: otp.attempts + 1 }, { transaction });
    throw new Error("OTP_INVALID");
  }
  await otp.update({ verified_at: new Date() }, { transaction });
}

export const createOnlineReservation = async (req: Request, res: Response) => {
  const branchId = Number(req.body.branch_id);
  const tableId = Number(req.body.table_id);
  const guestCount = Number(req.body.guest_count);
  const otpId = Number(req.body.otp_request_id);
  const phone = normalizePhone(req.body.phone);
  const name = String(req.body.name || "").trim();
  const code = String(req.body.otp_code || "");
  if (!Number.isInteger(branchId) || !Number.isInteger(tableId) || !Number.isInteger(guestCount) || guestCount < 1 || !Number.isInteger(otpId) || !name || !validPhone(phone) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Thông tin đặt bàn hoặc mã OTP không hợp lệ" });
  }

  try {
    const reservation = await sequelize.transaction(async (transaction) => {
      await verifyOtp(otpId, phone, code, transaction);
      const window = await getBranchAndWindow(branchId, req.body.start_time);
      if (!window) throw new Error("INVALID_WINDOW");
      const table = await Table.findOne({ where: { id: tableId, branch_id: branchId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!table || table.capacity < guestCount || table.status === "occupied") throw new Error("TABLE_UNAVAILABLE");
      const conflict = await Reservation.findOne({
        where: { table_id: tableId, status: { [Op.in]: ACTIVE_RESERVATION_STATUSES }, reservation_time: { [Op.lt]: window.end }, end_time: { [Op.gt]: window.start } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (conflict) throw new Error("TABLE_UNAVAILABLE");
      const [customer] = await Customer.findOrCreate({
        where: { phone },
        defaults: { phone, name, email: req.body.email?.trim() || null },
        transaction,
      });
      if (customer.name !== name || (req.body.email && customer.email !== req.body.email.trim())) {
        await customer.update({ name, email: req.body.email?.trim() || customer.email }, { transaction });
      }
      return Reservation.create({
        branch_id: branchId,
        customer_id: customer.id,
        reservation_code: `RSV-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 1000)}`,
        table_id: tableId,
        reservation_time: window.start,
        end_time: window.end,
        source: "online",
        status: "confirmed",
        customer_name: name,
        phone,
        email: req.body.email?.trim() || null,
        note: req.body.note?.trim() || null,
        guest_count: guestCount,
      }, { transaction });
    });
    return res.status(201).json({ message: "Đặt bàn thành công", data: reservation });
  } catch (error: any) {
    const errors: Record<string, string> = {
      OTP_NOT_FOUND: "Mã OTP không hợp lệ.", OTP_EXPIRED: "Mã OTP đã hết hạn.", OTP_LOCKED: "Bạn đã nhập sai OTP quá nhiều lần.", OTP_INVALID: "Mã OTP không đúng.",
      INVALID_WINDOW: "Chi nhánh không nhận đặt bàn vào thời gian này.", TABLE_UNAVAILABLE: "Bàn vừa không còn khả dụng. Vui lòng chọn bàn khác.",
    };
    if (error.name === "SequelizeExclusionConstraintError") return res.status(409).json({ message: errors.TABLE_UNAVAILABLE });
    return res.status(errors[error.message] ? 400 : 500).json({ message: errors[error.message] || "Không thể tạo đặt bàn" });
  }
};

export const createPhoneReservation = async (req: Request, res: Response) => {
  const branchId = Number(req.body.branch_id);
  const tableId = Number(req.body.table_id);
  const guestCount = Number(req.body.guest_count);
  const phone = normalizePhone(req.body.phone);
  const name = String(req.body.name || "").trim();
  if (!Number.isInteger(branchId) || !Number.isInteger(tableId) || !Number.isInteger(guestCount) || guestCount < 1 || !name || !validPhone(phone)) {
    return res.status(400).json({ message: "Thông tin đặt bàn qua điện thoại không hợp lệ" });
  }
  try {
    const reservation = await sequelize.transaction(async (transaction) => {
      const window = await getBranchAndWindow(branchId, req.body.start_time);
      if (!window) throw new Error("INVALID_WINDOW");
      const table = await Table.findOne({ where: { id: tableId, branch_id: branchId }, transaction, lock: transaction.LOCK.UPDATE });
      if (!table || table.capacity < guestCount || table.status === "occupied") throw new Error("TABLE_UNAVAILABLE");
      const conflict = await Reservation.findOne({
        where: { table_id: tableId, status: { [Op.in]: ACTIVE_RESERVATION_STATUSES }, reservation_time: { [Op.lt]: window.end }, end_time: { [Op.gt]: window.start } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (conflict) throw new Error("TABLE_UNAVAILABLE");
      const [customer] = await Customer.findOrCreate({
        where: { phone },
        defaults: { phone, name, email: req.body.email?.trim() || null },
        transaction,
      });
      return Reservation.create({
        branch_id: branchId,
        customer_id: customer.id,
        reservation_code: `TEL-${Date.now().toString(36).toUpperCase()}-${randomInt(100, 1000)}`,
        table_id: tableId,
        reservation_time: window.start,
        end_time: window.end,
        source: "phone",
        status: "confirmed",
        customer_name: name,
        phone,
        email: req.body.email?.trim() || undefined,
        note: req.body.note?.trim() || undefined,
        guest_count: guestCount,
      }, { transaction });
    });
    return res.status(201).json({ message: "Đã tạo đặt bàn qua điện thoại", data: reservation });
  } catch (error: any) {
    if (error.name === "SequelizeExclusionConstraintError" || error.message === "TABLE_UNAVAILABLE") return res.status(409).json({ message: "Bàn vừa không còn khả dụng" });
    if (error.message === "INVALID_WINDOW") return res.status(400).json({ message: "Chi nhánh không nhận đặt bàn vào thời gian này" });
    return res.status(500).json({ message: "Không thể tạo đặt bàn qua điện thoại" });
  }
};
