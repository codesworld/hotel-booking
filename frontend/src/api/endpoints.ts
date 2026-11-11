// One function per booking-api endpoint the UI uses.
import { request } from './client';
import type { AvailableRoom, Booking, LoginResponse, Page, Quote, Room, RoomType, User } from './types';

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password } }),
  register: (body: { email: string; password: string; fullName: string }) =>
    request<User>('/auth/register', { method: 'POST', body }),

  // Rooms
  availability: (query: { checkIn: string; checkOut: string; guests?: number; type?: RoomType | ''; page?: number }) =>
    request<Page<AvailableRoom>>('/rooms/availability', { query: { ...query, limit: 100 } }),
  room: (id: string) => request<Room>(`/rooms/${id}`),
  quote: (id: string, checkIn: string, checkOut: string) =>
    request<Quote>(`/rooms/${id}/quote`, { query: { checkIn, checkOut } }),
  allRooms: (token: string, page: number) =>
    request<Page<Room>>('/rooms', { token, query: { includeInactive: true, page, limit: 100 } }),
  createRoom: (token: string, body: { number: string; type: RoomType; capacity: number; pricePerNight: number; isActive: boolean }) =>
    request<Room>('/rooms', { method: 'POST', token, body }),
  patchRoom: (token: string, id: string, body: Partial<Omit<Room, 'id'>>) =>
    request<Room>(`/rooms/${id}`, { method: 'PATCH', token, body }),

  // Bookings
  createBooking: (token: string, body: { roomId: string; checkIn: string; checkOut: string; guests: number; cardToken: string }) =>
    request<Booking>('/bookings', { method: 'POST', token, body }),
  myBookings: (token: string, page: number) =>
    request<Page<Booking>>('/bookings', { token, query: { page, limit: 20 } }),
  cancelBooking: (token: string, id: string) =>
    request<Booking>(`/bookings/${id}/cancel`, { method: 'POST', token }),
};
