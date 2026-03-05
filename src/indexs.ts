import express from 'express';
import dotenv from "dotenv";
dotenv.config();


import path from 'path';
import sequelize from './config/db';


import authRouter from './routers/auth.routers';
import tableRouter from './routers/table.routers';
import menuRouter from './routers/menu.routers';
import categoryRouter from './routers/category.routers';
import orderRouter from './routers/order.routers';
import reservationRouter from './routers/reservation.routers';
import userRouter from './routers/user.routers';
import paymentRouter from './routers/payment.routers';
import orderItemRouter from './routers/orderItem.routers';
import Role from './models/Role';

const app = express();

/* ================= MIDDLEWARE ================= */

// đọc JSON (POSTMAN, FE gửi JSON)
app.use(express.json());

// đọc form
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
  res.send('Backend akelo');
});
// public files
app.use(express.static(path.join(__dirname, '../public')));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



app.use('/api/auth', authRouter);
app.use('/api/table', tableRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', orderRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/users', userRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/order-items', orderItemRouter);

app.listen(3000, () => {
  console.log('Server chạy http://localhost:3000');
});
const testSync = async () => {
  try {
    await sequelize.authenticate(); 
    console.log("Database connected successfully✅!");

    // Sync tất cả model với database
    await sequelize.sync({ alter: true }); 
    console.log("All models were synchronized successfully!");
  } catch (err) {
    console.error("Unable to connect or sync:", err);
  }
};

const initRoles = async () => {
  const roles = ["admin", "user"];

  for (const name of roles) {
    await Role.findOrCreate({
      where: { name },
    });
  }
};
(async () => {
  await sequelize.sync();
  await initRoles();
})();
console.log("JWT_SECRET =", process.env.JWT_SECRET);
testSync();
