// Monthly totals are interpolated to keep both the unit price decreasing and
// the total increasing as the institution adds students.
export const PRICE_POINTS = Object.freeze([
  { students: 20, unitCents: 5790 },
  { students: 50, unitCents: 3490 },
  { students: 100, unitCents: 2290 },
  { students: 250, unitCents: 1290 },
  { students: 500, unitCents: 790 },
  { students: 1000, unitCents: 430 }
].map(Object.freeze));

export function calculatePrice(students) {
  if (!Number.isSafeInteger(students) || students < 1 || students > 100000) throw new RangeError('Informe entre 1 e 100.000 alunos.');
  let totalCents;
  if (students <= 20) totalCents = students * 5790;
  else if (students >= 1000) totalCents = students * 430;
  else {
    const index = PRICE_POINTS.findIndex(point => point.students >= students);
    const lower = PRICE_POINTS[index - 1];
    const upper = PRICE_POINTS[index];
    const progress = (students - lower.students) / (upper.students - lower.students);
    totalCents = Math.round(lower.students * lower.unitCents + progress * (upper.students * upper.unitCents - lower.students * lower.unitCents));
  }
  const unitPrice = totalCents / students / 100;
  return { students, total: totalCents / 100, unitPrice, discount: Math.max(0, (1 - unitPrice / 57.9) * 100) };
}
