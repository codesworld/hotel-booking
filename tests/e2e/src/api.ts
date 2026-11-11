// Test SETUP through the API (fast and reliable): users, rooms, bookings.
// The UI is only used for the flow under test (PROJECT_PLAN.md, Phase 5).
import { randomBytes } from 'node:crypto';
import { expect, type APIRequestContext } from '@playwright/test';
import { env } from './env';

export interface User { id: string; email: string; fullName: string; role: 'GUEST' | 'ADMIN'; createdAt: string }
export interface Session { token: string; user: User }
export interface Room { id: string; number: string; type: string; capacity: number; pricePerNight: number; isActive: boolean }
export interface Booking { id: string; roomId: string; status: string; checkIn: string; checkOut: string; totalPrice: number }

const unique = () => randomBytes(4).toString('hex').slice(0, 6);

export class Api {
  constructor(private readonly request: APIRequestContext) {}

  private async call<T>(method: string, path: string, options: { token?: string; data?: unknown } = {}): Promise<T> {
    const response = await this.request.fetch(`${env.baseUrl}${path}`, {
      method,
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
      data: options.data,
    });
    expect(response.ok(), `${method} ${path} → ${response.status()}: ${await response.text()}`).toBe(true);
    return (await response.json()) as T;
  }

  /** POST /auth/login → a session the UI can use (see fixtures.ts). */
  async login(email: string, password: string): Promise<Session> {
    const result = await this.call<{ accessToken: string; user: User }>('POST', '/auth/login', { data: { email, password } });
    return { token: result.accessToken, user: result.user };
  }

  loginAsAdmin(): Promise<Session> {
    return this.login(env.admin.email, env.admin.password);
  }

  /** A brand-new guest that no other test uses (so "My bookings" only shows this test's data). */
  async newGuest(): Promise<Session> {
    const email = `e2e-${unique()}${unique()}@example.test`;
    const password = 'Secret123!';
    await this.call('POST', '/auth/register', { data: { email, password, fullName: 'E2E Guest' } });
    return this.login(email, password);
  }

  /** A room of this test's own, created as admin. Number is unique, e.g. "E2a1b2c3". */
  async createRoom(admin: Session, overrides: Partial<Omit<Room, 'id'>> = {}): Promise<Room> {
    return this.call<Room>('POST', '/rooms', {
      token: admin.token,
      data: { number: `E${unique()}`, type: 'DOUBLE', capacity: 2, pricePerNight: 100, ...overrides },
    });
  }

  async createBooking(guest: Session, roomId: string, checkIn: string, checkOut: string, guests = 1): Promise<Booking> {
    return this.call<Booking>('POST', '/bookings', {
      token: guest.token,
      data: { roomId, checkIn, checkOut, guests, cardToken: 'tok_success' },
    });
  }

  getBooking(guest: Session, id: string): Promise<Booking> {
    return this.call<Booking>('GET', `/bookings/${id}`, { token: guest.token });
  }

  async myBookings(guest: Session): Promise<Booking[]> {
    return (await this.call<{ items: Booking[] }>('GET', '/bookings?limit=100', { token: guest.token })).items;
  }

  /** The API's own price for a stay (the single source of truth for expected prices). */
  async quoteTotal(roomId: string, checkIn: string, checkOut: string): Promise<number> {
    return (await this.call<{ totalPrice: number }>('GET', `/rooms/${roomId}/quote?checkIn=${checkIn}&checkOut=${checkOut}`)).totalPrice;
  }
}

/** Today (UTC) + n days, "YYYY-MM-DD". */
export function day(offset: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset)).toISOString().slice(0, 10);
}

/** Same money format as the UI. */
export const money = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(amount);
