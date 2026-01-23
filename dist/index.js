"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const auth_routers_1 = __importDefault(require("./routers/auth.routers"));
const table_routers_1 = __importDefault(require("./routers/table.routers"));
const menu_routers_1 = __importDefault(require("./routers/menu.routers"));
const order_routers_1 = __importDefault(require("./routers/order.routers"));
const reservation_routers_1 = __importDefault(require("./routers/reservation.routers"));
const app = (0, express_1.default)();
/* ================= MIDDLEWARE ================= */
// đọc JSON (POSTMAN, FE gửi JSON)
app.use(express_1.default.json());
// đọc form
app.use(express_1.default.urlencoded({ extended: true }));
// public files
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
/* ================= VIEW ENGINE ================= */
app.set('view engine', 'ejs');
app.set('views', path_1.default.join(__dirname, 'views'));
/* ================= ROUTER ================= */
app.use('/api/auth', auth_routers_1.default);
app.use('/api/tables', table_routers_1.default);
app.use('/api/menu', menu_routers_1.default);
app.use('/api/orders', order_routers_1.default);
app.use('/api/reservations', reservation_routers_1.default);
/* ================= SERVER ================= */
app.listen(3000, () => {
    console.log('Server chạy http://localhost:3000');
});
