export const PRICE_POINTS: ReadonlyArray<{ students: number; unitCents: number }>;
export function calculatePrice(students: number): { students: number; total: number; unitPrice: number; discount: number };
