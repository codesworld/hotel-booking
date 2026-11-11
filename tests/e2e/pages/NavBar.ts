import type { Locator, Page } from '@playwright/test';

/** The top navigation bar, present on every page. */
export class NavBar {
  readonly search: Locator;
  readonly myBookings: Locator;
  readonly adminRooms: Locator;
  readonly user: Locator;
  readonly logout: Locator;
  readonly login: Locator;

  constructor(page: Page) {
    this.search = page.getByTestId('nav-search');
    this.myBookings = page.getByTestId('nav-my-bookings');
    this.adminRooms = page.getByTestId('nav-admin-rooms');
    this.user = page.getByTestId('nav-user');
    this.logout = page.getByTestId('nav-logout');
    this.login = page.getByTestId('nav-login');
  }
}
