import express from 'express';
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";
import { initSocket } from "./socket";
import http from "http";
import app from "./app";

import path from 'path';
import sequelize from './config/db'; 
import "./models";

import authRouter from './routers/auth.routers';
import tableRouter from './routers/table.routers';
import menuRouter from './routers/menu.routers';
import categoryRouter from './routers/category.routers';
import orderRouter from './routers/order.routers';
import reservationRouter from './routers/reservation.routers';
import userRouter from './routers/user.routers';
import paymentRouter from './routers/payment.routers';
import orderItemRouter from './routers/orderItem.routers';
import dashboardRouter from './routers/dashboard.routers';
import uploadRoutes from "./routers/upload.routers";
import contactRouter from './routers/contact.routers';
import branchRouter from './routers/branch.routers';
import roleRouter from './routers/role.routers';
import Role from './models/Role';
import kitchenRouter from './routers/kitchen.routers';
import ingredientRouter from './routers/ingredient.routers';
import RecipeRouter from './routers/recipe.routers';
import inventoryRouter from './routers/inventory.routers';
import purchaseRouter from './routers/purchase.routers';
import inventoryTransactionRouter from './routers/inventoryTransaction.routers';
import revenueRouter from './routers/revenue.routers';
import salesAnalyticsRouter from "./routers/salesAnalytics.routers";

dotenv.config();

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:5174"],
}));

app.use(express.static(path.join(__dirname, '../public')));

app.get('/', (req, res) => {
  res.send('Backend akelo');
});

/* ================= ROUTES ================= */
app.use('/api/auth', authRouter);
app.use('/api/table', tableRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', orderRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/reservations', reservationRouter); 
app.use('/api/users', userRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/order-items', orderItemRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api', uploadRoutes);
app.use('/api/contact', contactRouter);
app.use('/api/branches', branchRouter);
app.use('/api/roles', roleRouter);
app.use('/api/kitchen', kitchenRouter);
app.use('/api/ingredients', ingredientRouter);
app.use('/api/recipes', RecipeRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/inventory-transactions',inventoryTransactionRouter);
app.use('/api/purchases', purchaseRouter);
app.use('/api/reports', revenueRouter);
app.use('/api/analytics', salesAnalyticsRouter);

/* ================= SOCKET ================= */
const server = http.createServer(app);

const io = initSocket(server);

io.on("connection", (socket) => {
  console.log("Admin connected:", socket.id);
});

/* ================= DATABASE ================= */
const init = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected");
    await sequelize.sync();

    const roles = ["admin", "user", "chain_manager", "branch_manager", "waiter", "kitchen", "cashier", "customer"];
    for (const name of roles) {
      await Role.findOrCreate({ where: { name } });
    }

  } catch (err) {
    console.error("❌ DB error:", err);
  }
};

init();

/* ================= START SERVER ================= */
const PORT = 5000;

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
