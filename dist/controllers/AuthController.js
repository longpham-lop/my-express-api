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
exports.register = exports.login = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const models_1 = require("../models");
const bcrypt_1 = __importDefault(require("bcrypt"));
// LOGIN
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = req.body;
        // tìm user
        const user = yield models_1.User.findOne({
            where: { email },
            include: [{ model: models_1.Role, as: "role", attributes: ["name"] }],
        });
        // không tồn tại
        if (!user) {
            return res.status(400).json({
                message: "Sai email hoặc mật khẩu",
            });
        }
        // kiểm tra password
        const isMatch = yield bcrypt_1.default.compare(password, user.getDataValue("password"));
        if (!isMatch) {
            return res.status(400).json({
                message: "Sai email hoặc mật khẩu",
            });
        }
        // lấy role thật
        const role = ((_a = user.role) === null || _a === void 0 ? void 0 : _a.name) || "user";
        console.log("LOGIN ROLE:", user.getDataValue("role_id"));
        // tạo token
        const token = jsonwebtoken_1.default.sign({
            id: user.getDataValue("id"),
            role,
        }, process.env.JWT_SECRET, {
            expiresIn: "1d",
        });
        // trả dữ liệu
        return res.json({
            token,
            user: {
                id: user.get("id"),
                name: user.get("name"),
                email: user.get("email"),
                role,
            },
        });
    }
    catch (err) {
        console.log("login error:", err);
        return res.status(500).json({
            error: err.message,
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
        console.log("register error:", err);
        return res.status(500).json({
            error: err.message,
        });
    }
});
exports.register = register;
