// Prices are supplied by the persisted catalog. This module only performs arithmetic.
export function validPricePoints(points) {
  return Array.isArray(points) && points.length >= 2 && points.length <= 20 && points.every((point, index) => {
    if (!point || !Number.isInteger(point.students) || point.students < 1 || point.students > 100000 || !Number.isInteger(point.unitCents) || point.unitCents < 0 || point.unitCents > 100000000) return false;
    const previous = points[index - 1];
    return !index || (point.students > previous.students && point.unitCents <= previous.unitCents && point.students * point.unitCents >= previous.students * previous.unitCents);
  });
}
export function calculatePrice(students, points) {
  if (!Number.isSafeInteger(students) || students < 0 || students > 1000000 || !validPricePoints(points)) throw new RangeError('Quantidade ou faixas de preço inválidas.');
  const first = points[0], last = points[points.length - 1];
  let totalCents;
  if (students <= first.students) totalCents = students * first.unitCents;
  else if (students >= last.students) totalCents = students * last.unitCents;
  else {
    const index = points.findIndex(point => point.students >= students);
    const lower = points[index - 1], upper = points[index];
    const gap = BigInt(upper.students - lower.students);
    const lowerTotal = BigInt(lower.students) * BigInt(lower.unitCents);
    const totalDelta = BigInt(upper.students) * BigInt(upper.unitCents) - lowerTotal;
    const numerator = lowerTotal * gap + BigInt(students - lower.students) * totalDelta;
    totalCents = Number((2n * numerator + gap) / (2n * gap));
  }
  const unitPrice = students ? totalCents / students / 100 : 0;
  return { students, totalCents, total: totalCents / 100, unitPrice, discount: students && first.unitCents ? Math.max(0, (1 - unitPrice * 100 / first.unitCents) * 100) : 0 };
}
