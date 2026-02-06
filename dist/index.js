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
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("./config/db"));
const auth_routers_1 = __importDefault(require("./routers/auth.routers"));
const table_routers_1 = __importDefault(require("./routers/table.routers"));
const menu_routers_1 = __importDefault(require("./routers/menu.routers"));
const category_routers_1 = __importDefault(require("./routers/category.routers"));
const order_routers_1 = __importDefault(require("./routers/order.routers"));
const reservation_routers_1 = __importDefault(require("./routers/reservation.routers"));
const user_routers_1 = __importDefault(require("./routers/user.routers"));
const payment_routers_1 = __importDefault(require("./routers/payment.routers"));
const orderItem_routers_1 = __importDefault(require("./routers/orderItem.routers"));
const Role_1 = __importDefault(require("./models/Role"));
const app = (0, express_1.default)();
/* ================= MIDDLEWARE ================= */
// đọc JSON (POSTMAN, FE gửi JSON)
app.use(express_1.default.json());
// đọc form
app.use(express_1.default.urlencoded({ extended: true }));
app.get('/', (req, res) => {
    res.send('Backend akelo');
});
// public files
app.use(express_1.default.static(path_1.default.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path_1.default.join(__dirname, 'views'));
app.use('/api/auth', auth_routers_1.default);
app.use('/api/tables', table_routers_1.default);
app.use('/api/menu', menu_routers_1.default);
app.use('/api/orders', order_routers_1.default);
app.use('/api/category', category_routers_1.default);
app.use('/api/reservations', reservation_routers_1.default);
app.use('/api/users', user_routers_1.default);
app.use('/api/payments', payment_routers_1.default);
app.use('/api/order-items', orderItem_routers_1.default);
app.listen(3000, () => {
    console.log('Server chạy http://localhost:3000');
});
const testSync = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield db_1.default.authenticate();
        console.log("Database connected successfully✅!");
        // Sync tất cả model với database
        yield db_1.default.sync({ alter: true });
        console.log("All models were synchronized successfully!");
    }
    catch (err) {
        console.error("Unable to connect or sync:", err);
    }
});
const initRoles = () => __awaiter(void 0, void 0, void 0, function* () {
    const roles = ["admin", "user"];
    for (const name of roles) {
        yield Role_1.default.findOrCreate({
            where: { name },
        });
    }
});
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield db_1.default.sync();
    yield initRoles();
}))();
console.log("JWT_SECRET =", process.env.JWT_SECRET);
testSync();
