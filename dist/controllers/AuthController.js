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
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { email, password } = req.body;
        const user = (yield models_1.User.findOne({
            where: { email },
            include: [
                {
                    model: models_1.Role,
                    as: "role",
                },
            ],
        }));
        if (!user) {
            return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
        }
        const isMatch = yield bcrypt_1.default.compare(password, // password nhập
        user.getDataValue("password") // password đã hash
        );
        if (!isMatch) {
            return res.status(400).json({ message: "Sai email hoặc mật khẩu" });
        }
        const roleName = ((_a = user.role) === null || _a === void 0 ? void 0 : _a.name) || "user";
        const token = jsonwebtoken_1.default.sign({
            id: user.getDataValue("id"),
            role: user.getDataValue("role_id") === 1 ? "admin" : "user",
        }, process.env.JWT_SECRET, { expiresIn: "1d" });
        res.json({ token,
            user: {
                id: user.get("id"),
                name: user.get("name"),
                email: user.get("email"),
                role: roleName,
            },
        });
    }
    catch (err) {
        console.log("login error:", err);
        return res.status(500).json({ error: err.message });
    }
});
exports.login = login;
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password } = req.body;
        // 1️⃣ Validate
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "name, email, password là bắt buộc",
            });
        }
        // 2️⃣ Check email tồn tại
        const existingUser = yield models_1.User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "Email đã tồn tại" });
        }
        // 3️⃣ HASH password
        const hashedPassword = yield bcrypt_1.default.hash(password, 10);
        // 10 = saltRounds (chuẩn)
        // 4️⃣ Tạo user
        const user = yield models_1.User.create({
            name,
            email,
            password: hashedPassword,
            role_id: 2, // USER
        });
        // 5️⃣ Không trả password
        return res.status(201).json({
            id: user.get("id"),
            name: user.get("name"),
            email: user.get("email"),
            role_id: user.get("role_id"),
        });
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
exports.register = register;
