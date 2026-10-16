export function planPriceCents(value) {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [integer, decimals = ''] = normalized.split('.');
  const cents = Number(integer) * 100 + Number(decimals.padEnd(2, '0'));
  return cents <= 100000000 ? cents : null;
}

export function planStudentLimit(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) && Number(trimmed) >= 1 && Number(trimmed) <= 1000000 ? Number(trimmed) : undefined;
}
