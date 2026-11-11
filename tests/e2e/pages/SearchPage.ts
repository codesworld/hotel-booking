import type { Locator, Page } from '@playwright/test';

/** "/" — room search. */
export class SearchPage {
  readonly checkIn: Locator;
  readonly checkOut: Locator;
  readonly guests: Locator;
  readonly type: Locator;
  readonly submit: Locator;
  readonly results: Locator;

  constructor(private readonly page: Page) {
    this.checkIn = page.getByTestId('search-checkin');
    this.checkOut = page.getByTestId('search-checkout');
    this.guests = page.getByTestId('search-guests');
    this.type = page.getByTestId('search-type');
    this.submit = page.getByTestId('search-submit');
    this.results = page.getByTestId('search-results');
  }

  async open() {
    await this.page.goto('/');
  }

  async search(criteria: { checkIn: string; checkOut: string; guests: number; type?: 'SINGLE' | 'DOUBLE' | 'SUITE' }) {
    await this.checkIn.fill(criteria.checkIn);
    await this.checkOut.fill(criteria.checkOut);
    await this.guests.selectOption(String(criteria.guests));
    await this.type.selectOption(criteria.type ?? '');
    await this.submit.click();
  }

  roomCard(number: string): Locator {
    return this.page.getByTestId(`room-card-${number}`);
  }

  roomTotal(number: string): Locator {
    return this.page.getByTestId(`room-card-${number}-total`);
  }

  async openRoom(number: string) {
    await this.page.getByTestId(`room-card-${number}-view`).click();
  }
}
