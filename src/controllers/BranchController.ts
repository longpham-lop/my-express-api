import { Request, Response } from "express";
import { Branch, BranchSetting, StaffBranch, TableArea, User } from "../models";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const listPublicBranches = async (_req: Request, res: Response) => {
  const branches = await Branch.findAll({
    where: { status: "active" },
    attributes: ["id", "code", "name", "address", "phone", "opening_time", "closing_time", "is_accepting_reservations"],
    order: [["name", "ASC"]],
  });
  res.json({ data: branches });
};

export const listBranches = async (_req: Request, res: Response) => {
  const branches = await Branch.findAll({ include: [{ model: BranchSetting, as: "settings" }], order: [["name", "ASC"]] });
  res.json({ data: branches });
};

export const createBranch = async (req: Request, res: Response) => {
  const { code, name, address, phone, opening_time = "09:00", closing_time = "22:00" } = req.body;
  if (!code || !name || !address || !timePattern.test(opening_time) || !timePattern.test(closing_time)) {
    return res.status(400).json({ message: "code, name, address và giờ mở/đóng hợp lệ là bắt buộc" });
  }
  const branch = await Branch.create({ code: String(code).trim().toUpperCase(), name, address, phone, opening_time, closing_time });
  const settings = await BranchSetting.create({ branch_id: branch.id! });
  res.status(201).json({ data: { ...branch.toJSON(), settings } });
};

export const updateBranch = async (req: Request, res: Response) => {
  const branch = await Branch.findByPk(Number(req.params.id));
  if (!branch) return res.status(404).json({ message: "Không tìm thấy chi nhánh" });
  const allowed = ["name", "address", "phone", "opening_time", "closing_time", "is_accepting_reservations", "status"] as const;
  const values: Record<string, unknown> = {};
  for (const key of allowed) if (req.body[key] !== undefined) values[key] = req.body[key];
  if ((values.opening_time && !timePattern.test(String(values.opening_time))) || (values.closing_time && !timePattern.test(String(values.closing_time)))) {
    return res.status(400).json({ message: "Giờ phải theo định dạng HH:mm" });
  }
  await branch.update(values);
  res.json({ data: branch });
};

export const updateBranchSettings = async (req: Request, res: Response) => {
  const branchId = Number(req.params.id);
  const branch = await Branch.findByPk(branchId);
  if (!branch) return res.status(404).json({ message: "Không tìm thấy chi nhánh" });
  const [settings] = await BranchSetting.findOrCreate({ where: { branch_id: branchId } });
  const fields = ["default_table_duration_minutes", "reservation_interval_minutes", "reservation_lead_time_minutes"] as const;
  const values: Record<string, number> = {};
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      const value = Number(req.body[field]);
      if (!Number.isInteger(value) || value <= 0) return res.status(400).json({ message: `${field} phải là số nguyên dương` });
      values[field] = value;
    }
  }
  await settings.update(values);
  res.json({ data: settings });
};

export const listAreas = async (req: Request, res: Response) => {
  const data = await TableArea.findAll({ where: { branch_id: Number(req.params.id) }, order: [["sort_order", "ASC"], ["name", "ASC"]] });
  res.json({ data });
};

export const createArea = async (req: Request, res: Response) => {
  const branchId = Number(req.params.id);
  const branch = await Branch.findByPk(branchId);
  if (!branch) return res.status(404).json({ message: "Không tìm thấy chi nhánh" });
  if (!req.body.name?.trim()) return res.status(400).json({ message: "Tên khu vực là bắt buộc" });
  const data = await TableArea.create({ branch_id: branchId, name: req.body.name.trim(), sort_order: Number(req.body.sort_order) || 0 });
  res.status(201).json({ data });
};

export const assignStaff = async (req: Request, res: Response) => {
  const branchId = Number(req.params.id);
  const userId = Number(req.body.user_id);
  if (!Number.isInteger(userId)) return res.status(400).json({ message: "user_id không hợp lệ" });
  const [branch, user] = await Promise.all([Branch.findByPk(branchId), User.findByPk(userId)]);
  if (!branch || !user) return res.status(404).json({ message: "Không tìm thấy chi nhánh hoặc nhân viên" });
  const [assignment, created] = await StaffBranch.findOrCreate({
    where: { branch_id: branchId, user_id: userId },
    defaults: { branch_id: branchId, user_id: userId, is_primary: Boolean(req.body.is_primary), is_active: true },
  });
  if (!created) await assignment.update({ is_primary: Boolean(req.body.is_primary), is_active: req.body.is_active ?? true });
  res.status(created ? 201 : 200).json({ data: assignment });
};
