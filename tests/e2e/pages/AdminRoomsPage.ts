import type { Locator, Page } from '@playwright/test';

/** "/admin/rooms" — room management. Rows are identified by room number. */
export class AdminRoomsPage {
  readonly number: Locator;
  readonly type: Locator;
  readonly capacity: Locator;
  readonly price: Locator;
  readonly active: Locator;
  readonly submit: Locator;
  readonly createdBanner: Locator;
  readonly accessDenied: Locator;

  constructor(private readonly page: Page) {
    this.number = page.getByTestId('admin-room-number');
    this.type = page.getByTestId('admin-room-type');
    this.capacity = page.getByTestId('admin-room-capacity');
    this.price = page.getByTestId('admin-room-price');
    this.active = page.getByTestId('admin-room-active');
    this.submit = page.getByTestId('admin-room-submit');
    this.createdBanner = page.getByTestId('admin-room-created');
    this.accessDenied = page.getByTestId('access-denied');
  }

  async open() {
    await this.page.goto('/admin/rooms');
  }

  async createRoom(room: { number: string; type: 'SINGLE' | 'DOUBLE' | 'SUITE'; capacity: number; pricePerNight: number }) {
    await this.number.fill(room.number);
    await this.type.selectOption(room.type);
    await this.capacity.fill(String(room.capacity));
    await this.price.fill(String(room.pricePerNight));
    await this.submit.click();
  }

  row(number: string): Locator {
    return this.page.getByTestId(`admin-room-row-${number}`);
  }

  status(number: string): Locator {
    return this.page.getByTestId(`admin-room-status-${number}`);
  }
}
