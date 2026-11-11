// Independent test oracle for rule 10 (NOT a copy of the API code):
// Friday and Saturday nights cost +20%, total rounded to 2 decimals.
// Works in integer "thousandths of a cent" to avoid floating point errors.
export function expectedPrice(pricePerNight: number, checkIn: string, checkOut: string): number {
  const baseCents = Math.round(pricePerNight * 100);
  let totalMilliCents = 0; // 1/1000 of a cent
  for (let d = new Date(`${checkIn}T00:00:00Z`); d < new Date(`${checkOut}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const weekday = d.getUTCDay();
    const isWeekend = weekday === 5 || weekday === 6;
    totalMilliCents += isWeekend ? baseCents * 1200 : baseCents * 1000;
  }
  return Math.round(totalMilliCents / 1000) / 100; // half-up for positive numbers
}
