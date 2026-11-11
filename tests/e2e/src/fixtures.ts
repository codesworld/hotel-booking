// Fixtures: page objects, the API helper, and `loginAs` (login via API, no login form).
import { test as base, expect, type Page } from '@playwright/test';
import { AdminRoomsPage } from '../pages/AdminRoomsPage';
import { MyBookingsPage } from '../pages/MyBookingsPage';
import { NavBar } from '../pages/NavBar';
import { RoomPage } from '../pages/RoomPage';
import { SearchPage } from '../pages/SearchPage';
import { Api, type Session } from './api';

/**
 * Logs the browser in WITHOUT the login form: the session from POST /auth/login is written to
 * sessionStorage before the app starts. The key and shape are the app's contract
 * (frontend/src/auth/AuthContext.tsx, STORAGE_KEY "hotel-booking-session").
 */
export async function loginAs(page: Page, session: Session) {
  await page.addInitScript((value) => {
    if (!window.sessionStorage.getItem('hotel-booking-session')) {
      window.sessionStorage.setItem('hotel-booking-session', value);
    }
  }, JSON.stringify(session));
}

type Fixtures = {
  api: Api;
  nav: NavBar;
  searchPage: SearchPage;
  roomPage: RoomPage;
  myBookings: MyBookingsPage;
  adminRooms: AdminRoomsPage;
};

export const test = base.extend<Fixtures>({
  api: async ({ request }, use) => use(new Api(request)),
  nav: async ({ page }, use) => use(new NavBar(page)),
  searchPage: async ({ page }, use) => use(new SearchPage(page)),
  roomPage: async ({ page }, use) => use(new RoomPage(page)),
  myBookings: async ({ page }, use) => use(new MyBookingsPage(page)),
  adminRooms: async ({ page }, use) => use(new AdminRoomsPage(page)),
});

export { expect };
