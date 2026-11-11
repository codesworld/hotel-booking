// In-memory payment storage. Everything is lost when the container restarts,
// which is fine for a simulated provider.
import { randomUUID } from 'node:crypto';

export type PaymentStatus = 'APPROVED' | 'DECLINED';

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
}

const payments = new Map<string, Payment>();

export function savePayment(bookingId: string, amount: number, status: PaymentStatus): Payment {
  const payment: Payment = {
    id: randomUUID(),
    bookingId,
    amount,
    status,
    createdAt: new Date().toISOString(),
  };
  payments.set(payment.id, payment);
  return payment;
}

export function findPayment(id: string): Payment | undefined {
  return payments.get(id);
}
