"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.changePasswordFromLogin = exports.changePassword = exports.register = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const bcrypt_1 = __importDefault(require("bcrypt"));
// LOGIN
// LOGIN
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = req.body;
        // 1. Kiểm tra dữ liệu đầu vào
        if (!email || !password) {
            return res.status(400).json({
                message: "Email và mật khẩu là bắt buộc",
            });
        }
        // 2. Tìm user theo email
        const user = yield models_1.User.findOne({
            where: { email },
            include: [
                {
                    model: models_1.Role,
                    as: "role",
                    attributes: ["id", "name"],
                },
            ],
        });
        // 3. Không tìm thấy user
        if (!user) {
            return res.status(400).json({
                message: "Sai email hoặc mật khẩu",
            });
        }
        // 4. Kiểm tra trạng thái tài khoản
        const status = user.getDataValue("status");
        if (status !== "active") {
            return res.status(403).json({
                message: "Tài khoản đã bị vô hiệu hóa",
            });
        }
        // 5. Kiểm tra password
        const isMatch = yield bcrypt_1.default.compare(password, user.getDataValue("password"));
        if (!isMatch) {
            return res.status(400).json({
                message: "Sai email hoặc mật khẩu",
            });
        }
        // 6. Lấy role từ database
        const role = ((_a = user.role) === null || _a === void 0 ? void 0 : _a.name) || "user";
        // 7. Lấy branch_id
        const branchId = user.getDataValue("branch_id");
        console.log("========== LOGIN ==========");
        console.log("User ID:", user.getDataValue("id"));
        console.log("Role:", role);
        console.log("Branch ID:", branchId);
        console.log("============================");
        // 8. Tạo JWT
        const token = jsonwebtoken_1.default.sign({
            id: user.getDataValue("id"),
            role,
            branchId: branchId !== null && branchId !== void 0 ? branchId : null,
        }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });
        // 9. Trả dữ liệu về frontend
        return res.json({
            token,
            user: {
                id: user.getDataValue("id"),
                name: user.getDataValue("name"),
                email: user.getDataValue("email"),
                role,
                branchId: branchId !== null && branchId !== void 0 ? branchId : null,
            },
        });
    }
    catch (err) {
        console.log("login error:", err);
        const errorMessage = err instanceof Error ? err.message : "Đã xảy ra lỗi khi đăng nhập";
        return res.status(500).json({
            message: errorMessage,
        });
    }
});
exports.login = login;
// REGISTER
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password } = req.body;
        // validate
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "name, email, password là bắt buộc",
            });
        }
        // check email tồn tại
        const existingUser = yield models_1.User.findOne({
            where: { email },
        });
        if (existingUser) {
            return res.status(400).json({
                message: "Email đã tồn tại",
            });
        }
        // hash password
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        // tạo admin
        const defaultRole = (yield models_1.Role.findOne({ where: { name: "customer" } })) || (yield models_1.Role.findOne({ where: { name: "user" } }));
        if (!defaultRole) {
            return res.status(500).json({ message: "Chưa khởi tạo vai trò mặc định" });
        }
        const user = yield models_1.User.create({
            name,
            email,
            password: hashedPassword,
            role_id: defaultRole.id,
        });
        console.log("REGISTER ROLE:", user.get("role_id"));
        // response
        return res.status(201).json({
            id: user.get("id"),
            name: user.get("name"),
            email: user.get("email"),
            role_id: user.get("role_id"),
        });
    }
    catch (err) {
        console.error("register error:", err);
        const errorMessage = err instanceof Error
            ? err.message
            : "Đã xảy ra lỗi khi đăng ký tài khoản";
        return res.status(500).json({
            error: errorMessage,
        });
    }
});
exports.register = register;
const changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // 1. Phải đăng nhập mới được đổi mật khẩu
        if (!req.user) {
            return res.status(401).json({
                message: "Vui lòng đăng nhập",
            });
        }
        const { currentPassword, newPassword, confirmPassword, } = req.body;
        // 2. Kiểm tra dữ liệu đầu vào
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                message: "Vui lòng nhập đầy đủ các trường mật khẩu",
            });
        }
        if (typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            typeof confirmPassword !== "string") {
            return res.status(400).json({
                message: "Dữ liệu mật khẩu không hợp lệ",
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({
                message: "Mật khẩu mới phải có ít nhất 8 ký tự",
            });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                message: "Mật khẩu xác nhận không khớp",
            });
        }
        // 3. Lấy tài khoản từ danh tính trong JWT
        const user = yield models_1.User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({
                message: "Không tìm thấy tài khoản",
            });
        }
        if (user.status !== "active") {
            return res.status(403).json({
                message: "Tài khoản đã bị vô hiệu hóa",
            });
        }
        // 4. Kiểm tra mật khẩu hiện tại bằng bcrypt
        const isMatch = yield bcrypt_1.default.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({
                message: "Mật khẩu hiện tại không chính xác",
            });
        }
        // 5. Không cho đặt lại chính mật khẩu hiện tại
        const isSamePassword = yield bcrypt_1.default.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                message: "Mật khẩu mới phải khác mật khẩu hiện tại",
            });
        }
        // 6. Mã hóa và cập nhật mật khẩu mới
        const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
        user.password = hashedPassword;
        yield user.save();
        return res.status(200).json({
            message: "Đổi mật khẩu thành công",
        });
    }
    catch (err) {
        console.error("Change password error:", err);
        return res.status(500).json({
            message: "Lỗi server khi đổi mật khẩu",
        });
    }
});
exports.changePassword = changePassword;
const changePasswordFromLogin = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, currentPassword, newPassword, confirmPassword } = req.body;
        if (typeof email !== "string" ||
            typeof currentPassword !== "string" ||
            typeof newPassword !== "string" ||
            typeof confirmPassword !== "string" ||
            !email.trim() ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword) {
            return res.status(400).json({
                message: "Vui lòng nhập đầy đủ thông tin",
            });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({
                message: "Mật khẩu mới phải có ít nhất 8 ký tự",
            });
        }
        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                message: "Mật khẩu xác nhận không khớp",
            });
        }
        if (currentPassword === newPassword) {
            return res.status(400).json({
                message: "Mật khẩu mới phải khác mật khẩu hiện tại",
            });
        }
        const user = yield models_1.User.findOne({
            where: {
                email: email.trim(),
            },
        });
        // Không tiết lộ email có tồn tại hay không
        if (!user || user.status !== "active") {
            return res.status(400).json({
                message: "Thông tin tài khoản hoặc mật khẩu không chính xác",
            });
        }
        const isCurrentPasswordValid = yield bcrypt_1.default.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                message: "Thông tin tài khoản hoặc mật khẩu không chính xác",
            });
        }
        const isSamePassword = yield bcrypt_1.default.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                message: "Mật khẩu mới phải khác mật khẩu hiện tại",
            });
        }
        user.password = yield bcrypt_1.default.hash(newPassword, 10);
        yield user.save();
        return res.status(200).json({
            message: "Đổi mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
        });
    }
    catch (error) {
        console.error("CHANGE PASSWORD FROM LOGIN ERROR:", error);
        return res.status(500).json({
            message: "Lỗi máy chủ khi đổi mật khẩu",
        });
    }
});
exports.changePasswordFromLogin = changePasswordFromLogin;
