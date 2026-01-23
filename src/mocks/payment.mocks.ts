import { Payment } from '../models/Payment';

export const payments: Payment[] = [
  {
    id: 1,
    orderId: 101,
    amount: 150000,
    method: 'cash',
    status: 'paid',
  },
  {
    id: 2,
    orderId: 102,
    amount: 200000,
    method: 'momo',
    status: 'unpaid',
  },
];
