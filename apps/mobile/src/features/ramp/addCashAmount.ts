/** Currency syntax, not provider limits. Do not guess a MoonPay minimum/maximum. */
export function parseCashAmount(raw: string): number | null {
  const value = raw.trim().replace(',', '.');
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return null;
  const amount = Number(value);
  return Number.isFinite(amount) &&
    amount > 0 &&
    Number.isSafeInteger(Math.round(amount * 100))
    ? amount
    : null;
}
