// Display helpers.

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' });
export const formatMoney = (amount: number) => money.format(amount);

const dateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
/** "2026-12-04" → "Fri 4 Dec 2026" (dates are UTC calendar dates). */
export const formatDate = (iso: string) => dateFormat.format(new Date(`${iso}T00:00:00Z`));

/** Today (UTC) plus n days as "YYYY-MM-DD". */
export function isoDay(offset: number): string {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  return day.toISOString().slice(0, 10);
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pending payment',
  CONFIRMED: 'Confirmed',
  PAYMENT_FAILED: 'Payment failed',
  CANCELLED: 'Cancelled',
};
