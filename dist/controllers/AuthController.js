"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.register = void 0;
const register = (req, res) => {
    res.json({ message: "Register user" });
};
exports.register = register;
const login = (req, res) => {
    res.json({ message: "Login user" });
};
exports.login = login;
const logout = (req, res) => {
    res.json({ message: "Logout user" });
};
exports.logout = logout;
