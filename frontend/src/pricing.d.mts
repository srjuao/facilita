export interface PricePoint { students: number; unitCents: number }
export function validPricePoints(points: unknown): points is PricePoint[];
export function calculatePrice(students: number, points: readonly PricePoint[]): { students: number; totalCents: number; total: number; unitPrice: number; discount: number };
