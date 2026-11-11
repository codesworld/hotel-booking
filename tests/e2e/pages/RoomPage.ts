import type { Locator, Page } from '@playwright/test';

export type CardToken = 'tok_success' | 'tok_decline' | 'tok_slow' | 'tok_error' | 'tok_unknown';

/** "/rooms/:id" — room details, price breakdown and the booking form. */
export class RoomPage {
  readonly title: Locator;
  readonly priceBreakdown: Locator;
  readonly priceTotal: Locator;
  readonly checkIn: Locator;
  readonly checkOut: Locator;
  readonly guests: Locator;
  readonly cardToken: Locator;
  readonly submit: Locator;
  readonly bookingError: Locator;
  readonly bookingErrorMessage: Locator;
  readonly bookingsLinkInError: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByTestId('room-title');
    this.priceBreakdown = page.getByTestId('price-breakdown');
    this.priceTotal = page.getByTestId('price-total');
    this.checkIn = page.getByTestId('booking-checkin');
    this.checkOut = page.getByTestId('booking-checkout');
    this.guests = page.getByTestId('booking-guests');
    this.cardToken = page.getByTestId('booking-card-token');
    this.submit = page.getByTestId('booking-submit');
    this.bookingError = page.getByTestId('booking-error');
    this.bookingErrorMessage = page.getByTestId('booking-error-message');
    this.bookingsLinkInError = page.getByTestId('booking-error-bookings-link');
  }

  /** Opens the room page directly (as a search result link would). */
  async open(roomId: string, stay: { checkIn: string; checkOut: string; guests?: number }) {
    await this.page.goto(`/rooms/${roomId}?checkIn=${stay.checkIn}&checkOut=${stay.checkOut}&guests=${stay.guests ?? 1}`);
  }

  /** Error shown under one field, named like the API field: checkIn, checkOut, guests, cardToken. */
  fieldError(field: string): Locator {
    return this.page.getByTestId(`booking-error-${field}`);
  }

  priceNight(date: string): Locator {
    return this.page.getByTestId(`price-night-${date}`);
  }

  async setDates(checkIn: string, checkOut: string) {
    await this.checkIn.fill(checkIn);
    await this.checkOut.fill(checkOut);
  }

  async book(cardToken: CardToken = 'tok_success') {
    await this.cardToken.selectOption(cardToken);
    await this.submit.click();
  }
}
