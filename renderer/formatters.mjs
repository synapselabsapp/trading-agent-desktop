export function numberOrNaN(value) {
  if (value === null || value === undefined || value === '') return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function formatMoney(value) {
  const parsed = numberOrNaN(value);
  return Number.isFinite(parsed)
    ? `$${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
}

export function formatValue(value, digits = 4) {
  const parsed = numberOrNaN(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
}
