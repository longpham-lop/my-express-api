import express from 'express';
import path from 'path';

import authRouter from './routers/auth.routers';
import tableRouter from './routers/table.routers';
import menuRouter from './routers/menu.routers';
import orderRouter from './routers/order.routers';
import reservationRouter from './routers/reservation.routers';
import userRouter from './routers/user.routers';
import paymentRouter from './routers/payment.routers';

const app = express();

/* ================= MIDDLEWARE ================= */

// đọc JSON (POSTMAN, FE gửi JSON)
app.use(express.json());

// đọc form
app.use(express.urlencoded({ extended: true }));
app.get('/', (req, res) => {
  res.send('Backend nhà hàng đang chạy OK 🚀');
});
// public files
app.use(express.static(path.join(__dirname, '../public')));


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



app.use('/api/auth', authRouter);
app.use('/api/tables', tableRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', orderRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/users', userRouter);
app.use('api/payments', paymentRouter);

app.listen(3000, () => {
  console.log('Server chạy http://localhost:3000');
});
