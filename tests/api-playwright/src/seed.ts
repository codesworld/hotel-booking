// Access to the seeded dataset (loaded once by global-setup.ts).
// Seed data is READ-ONLY for tests (catalog rule 1.2.1).
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env';

export const SEED_FILE = path.resolve(__dirname, '..', '.seed.json');

export interface Room { id: string; number: string; type: string; capacity: number; pricePerNight: number; isActive: boolean }
export interface Booking {
  id: string; roomId: string; userId: string; checkIn: string; checkOut: string; guests: number;
  totalPrice: number; status: string; paymentId: string | null; createdAt: string; cancelledAt: string | null;
}
export interface User { id: string; email: string; fullName: string; role: string; createdAt: string }

interface SeedFile { users: User[]; rooms: Room[]; bookings: Booking[] }

export class Seed {
  private readonly data: SeedFile = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));

  private user(email: string): User {
    const user = this.data.users.find((u) => u.email === email);
    if (!user) throw new Error(`Seed user ${email} not found`);
    return user;
  }
  get admin() { return this.user(env.admin.email); }
  get g1() { return this.user(env.guest1.email); }
  get g2() { return this.user(env.guest2.email); }

  /** R101 … R302 */
  room(number: string): Room {
    const room = this.data.rooms.find((r) => r.number === number);
    if (!room) throw new Error(`Seed room ${number} not found`);
    return room;
  }

  /** SB1 … SB6, as described in docs/test-cases.md section 1.3. */
  booking(n: 1 | 2 | 3 | 4 | 5 | 6): Booking {
    const inRoom = (number: string, status: string) =>
      this.data.bookings
        .filter((b) => b.roomId === this.room(number).id && b.status === status)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const pick: Record<number, () => Booking | undefined> = {
      1: () => inRoom('201', 'CONFIRMED').at(-1), // D+10, the later one
      2: () => inRoom('202', 'CANCELLED')[0],
      3: () => inRoom('102', 'PENDING_PAYMENT')[0],
      4: () => inRoom('101', 'PAYMENT_FAILED')[0],
      5: () => inRoom('301', 'CONFIRMED')[0],
      6: () => inRoom('201', 'CONFIRMED')[0], // D+1, the earlier one
    };
    const booking = pick[n]();
    if (!booking) throw new Error(`Seed booking SB${n} not found`);
    return booking;
  }
}
