import express from 'express';
import dotenv from "dotenv";
import cors from "cors";
import { Server } from "socket.io";
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
import Role from './models/Role';

dotenv.config();

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors({
  origin: "http://localhost:5173",
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

/* ================= SOCKET ================= */
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("🔌 Admin connected:", socket.id);
});

/* ================= DATABASE ================= */
const init = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected");

    await sequelize.sync();

    const roles = ["admin", "user"];
    for (const name of roles) {
      await Role.findOrCreate({ where: { name } });
    }

  } catch (err) {
    console.error("❌ DB error:", err);
  }
};

init();

/* ================= START SERVER ================= */
const PORT = 3000;

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});