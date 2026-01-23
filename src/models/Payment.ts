export interface Payment {
  id: number;
  orderId: number;
  amount: number;
  method: 'cash' | 'banking' | 'momo';
  status: 'paid' | 'unpaid';
}
