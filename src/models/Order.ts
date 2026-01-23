export interface Order{
    id: number;
    tableID: number;
    create: Date;
    status: 'pending' | 'paid' | 'cancelled';
}