// Creates the test's OWN data (rooms, users, bookings) and reads lists.
// Names follow the catalog: OWN_ROOM, NEW_ROOM, NEW_USER, BOOKING.
import { randomBytes } from 'node:crypto';
import { expect } from '@playwright/test';
import type { ApiClient, ApiResponse } from './api';
import { expectOk } from './assertions';
import { day } from './dates';
import type { Booking, Room } from './seed';

export interface Tokens { admin: string; g1: string; g2: string }
export interface FreshUser { id: string; email: string; password: string; token: string }

/** 1-10 chars of [A-Za-z0-9-], unique per call. */
export const uniqueRoomNumber = () => `T${randomBytes(4).toString('hex').slice(0, 6)}`;
export const uniqueEmail = (prefix = 'user') => `${prefix}-${randomBytes(6).toString('hex')}@example.test`;
export const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

/** NEW_ROOM */
export const newRoom = (overrides: Record<string, unknown> = {}) => ({
  number: uniqueRoomNumber(),
  type: 'DOUBLE',
  capacity: 2,
  pricePerNight: 100,
  ...overrides,
});

/** NEW_USER */
export const newUser = (overrides: Record<string, unknown> = {}) => ({
  email: uniqueEmail(),
  password: 'Secret123!',
  fullName: 'Test User',
  ...overrides,
});

/** BOOKING (D+30 → D+32, 1 guest, tok_success) */
export const bookingBody = (roomId: string, overrides: Record<string, unknown> = {}) => ({
  roomId,
  checkIn: day(30),
  checkOut: day(32),
  guests: 1,
  cardToken: 'tok_success',
  ...overrides,
});

export class TestData {
  constructor(
    private readonly api: ApiClient,
    private readonly tokens: Tokens,
  ) {}

  /** OWN_ROOM: a room created by ADMIN for this test only. */
  async createRoom(overrides: Record<string, unknown> = {}): Promise<Room> {
    const res = await this.api.post('/rooms', { token: this.tokens.admin, body: newRoom(overrides) });
    expectOk(res, 201, 'room');
    return res.body;
  }

  /** A registered and logged-in guest that no other test uses. */
  async freshUser(): Promise<FreshUser> {
    const body = newUser();
    const reg = await this.api.post('/auth/register', { body });
    expectOk(reg, 201, 'user');
    const login = await this.api.post('/auth/login', { body: { email: body.email, password: body.password } });
    expectOk(login, 200, 'login-response');
    return { id: reg.body.id, email: body.email, password: body.password, token: login.body.accessToken };
  }

  /** POST /bookings without assertions (for tests that expect errors). */
  book(token: string, roomId: string, overrides: Record<string, unknown> = {}): Promise<ApiResponse> {
    return this.api.post('/bookings', { token, body: bookingBody(roomId, overrides) });
  }

  /** POST /bookings that must succeed (201). */
  async createBooking(token: string, roomId: string, overrides: Record<string, unknown> = {}): Promise<Booking> {
    const res = await this.book(token, roomId, overrides);
    expectOk(res, 201, 'booking');
    return res.body;
  }

  async getBooking(id: string, token = this.tokens.admin): Promise<Booking> {
    const res = await this.api.get(`/bookings/${id}`, { token });
    expectOk(res, 200, 'booking');
    return res.body;
  }

  async getRoom(id: string): Promise<Room> {
    const res = await this.api.get(`/rooms/${id}`);
    expectOk(res, 200, 'room');
    return res.body;
  }

  /** Number of bookings the user sees (use with freshUser for state checks). */
  async bookingsTotal(token: string): Promise<number> {
    const res = await this.api.get('/bookings', { token });
    expectOk(res, 200, 'booking-list');
    return res.body.total;
  }

  /** Reads every page of a paginated list endpoint (path may already contain a query). */
  async allPages<T = any>(path: string, token?: string): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const separator = path.includes('?') ? '&' : '?';
      const res = await this.api.get(`${path}${separator}limit=100&page=${page}`, { token });
      expect(res.status, res.text).toBe(200);
      items.push(...res.body.items);
      if (res.body.items.length < 100) return items;
    }
  }

  /** Is there a room with this number (active or not)? Used to prove a room was NOT created. */
  async roomNumberExists(number: string): Promise<boolean> {
    const rooms = await this.allPages<Room>('/rooms?includeInactive=true', this.tokens.admin);
    return rooms.some((r) => r.number === number);
  }

  /** Room ids returned by availability search for the given query string. */
  async availableRoomIds(query: string): Promise<string[]> {
    const rooms = await this.allPages<Room>(`/rooms/availability?${query}`);
    return rooms.map((r) => r.id);
  }
}
