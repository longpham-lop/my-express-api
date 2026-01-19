import express from 'express';
import path from 'path';
import webRouter from './routers/web.routers';

const app = express();

// cho phép đọc form
app.use(express.urlencoded({ extended: true }));

// public files
app.use(express.static(path.join(__dirname, '../public')));

// view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// router
app.use('/', webRouter);

app.listen(3000, () => {
  console.log('Server chạy http://localhost:3000');
});
