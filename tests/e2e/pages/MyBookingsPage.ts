import type { Locator, Page } from '@playwright/test';

/** "/bookings" — the logged-in user's bookings. Rows are identified by booking id. */
export class MyBookingsPage {
  readonly createdBanner: Locator;
  readonly table: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.createdBanner = page.getByTestId('booking-created');
    this.table = page.getByTestId('bookings-table');
    this.rows = page.locator('[data-testid^="booking-row-"]');
  }

  async open() {
    await this.page.goto('/bookings');
  }

  /** The id of the booking just created (the app redirects to /bookings?created=<id>). */
  createdBookingId(): string {
    const id = new URL(this.page.url()).searchParams.get('created');
    if (!id) throw new Error(`No ?created= in ${this.page.url()}`);
    return id;
  }

  row(id: string): Locator {
    return this.page.getByTestId(`booking-row-${id}`);
  }

  /** The status badge; its data-status attribute holds the raw status (e.g. CONFIRMED). */
  status(id: string): Locator {
    return this.page.getByTestId(`booking-status-${id}`);
  }

  room(id: string): Locator {
    return this.page.getByTestId(`booking-room-${id}`);
  }

  total(id: string): Locator {
    return this.page.getByTestId(`booking-total-${id}`);
  }

  cancelButton(id: string): Locator {
    return this.page.getByTestId(`booking-cancel-${id}`);
  }

  async cancel(id: string) {
    await this.cancelButton(id).click();
    await this.page.getByTestId(`booking-cancel-confirm-${id}`).click();
  }
}
