export interface Reservation {
  id: number;
  customerName: string;
  phone: string;
  tableId: number;
  reserveTime: Date;
  status: 'pending' | 'confirmed' | 'cancelled';
}
