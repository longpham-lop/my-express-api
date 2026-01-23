import { Router, Request, Response } from 'express';
import { Payment } from '../models/Payment';
import { payments } from '../mocks/payment.mocks';

const router = Router();

/**
 * GET /api/payments
 */
router.get('/', (req: Request, res: Response) => {
  res.json(payments);
});

/**
 * GET /api/payments/:id
 */
router.get('/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const payment = payments.find((p: Payment) => p.id === id);

  if (!payment) {
    return res.status(404).json({ message: 'Payment not found' });
  }

  res.json(payment);
});

/**
 * POST /api/payments
 */
router.post('/', (req: Request, res: Response) => {
  const { orderId, amount, method, status } =
    req.body as Omit<Payment, 'id'>;

  const newPayment: Payment = {
    id: payments.length + 1,
    orderId,
    amount,
    method,
    status,
  };

  payments.push(newPayment);

  res.status(201).json(newPayment);
});

export default router;
