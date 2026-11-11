// Shapes of booking-api responses (see tests/schemas/ for the exact contracts).

export type Role = 'GUEST' | 'ADMIN';
export type RoomType = 'SINGLE' | 'DOUBLE' | 'SUITE';
export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'PAYMENT_FAILED' | 'CANCELLED';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: User;
}

export interface Room {
  id: string;
  number: string;
  type: RoomType;
  capacity: number;
  pricePerNight: number;
  isActive: boolean;
}

export interface AvailableRoom extends Room {
  nights: number;
  totalPrice: number;
}

export interface Quote {
  roomId: string;
  checkIn: string;
  checkOut: string;
  pricePerNight: number;
  nights: { date: string; isWeekend: boolean; price: number }[];
  totalPrice: number;
}

export interface Booking {
  id: string;
  roomId: string;
  userId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  status: BookingStatus;
  paymentId: string | null;
  createdAt: string;
  cancelledAt: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
