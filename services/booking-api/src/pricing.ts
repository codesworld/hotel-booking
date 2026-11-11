// Rule 10: totalPrice = sum of nightly prices; Friday and Saturday nights cost +20%.
// A "Friday night" is the night that starts on Friday (check-in Friday, leave Saturday).
// Decimal arithmetic is used (no floating point errors); the total is rounded once,
// half-up, to 2 decimals.
import { Prisma } from '@prisma/client';
import { WEEKEND_SURCHARGE } from './rules';
import { addDays, formatIsoDate } from './utils/dates';

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

const FRIDAY = 5;
const SATURDAY = 6;

export interface NightPrice {
  date: string;
  isWeekend: boolean;
  price: Decimal;
}

export function calculatePrice(pricePerNight: Decimal | number, checkIn: Date, checkOut: Date) {
  const basePrice = new Decimal(pricePerNight);
  const nights: NightPrice[] = [];
  let total = new Decimal(0);

  for (let night = checkIn; night < checkOut; night = addDays(night, 1)) {
    const weekday = night.getUTCDay();
    const isWeekend = weekday === FRIDAY || weekday === SATURDAY;
    const price = isWeekend ? basePrice.mul(WEEKEND_SURCHARGE) : basePrice;
    nights.push({ date: formatIsoDate(night), isWeekend, price });
    total = total.add(price);
  }

  return {
    nights,
    totalPrice: total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
  };
}
