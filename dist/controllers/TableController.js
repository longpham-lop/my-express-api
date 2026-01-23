"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTable = exports.getTables = void 0;
const getTables = (req, res) => {
    res.json({ tables: [] });
};
exports.getTables = getTables;
const createTable = (req, res) => {
    res.json({ message: "Create table" });
};
exports.createTable = createTable;
