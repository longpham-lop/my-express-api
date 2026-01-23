export interface Table{
    id: number;
    name: string;
    capacity: number;
    status: 'available' | 'reserved' | 'occupied';
}