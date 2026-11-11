// Critical flows 5 and 6: admin room management and the admin page guard.
import { randomBytes } from 'node:crypto';
import { test, expect, loginAs } from '../src/fixtures';
import { day } from '../src/api';
import { SearchPage } from '../pages/SearchPage';

test.describe('Admin', () => {
  test('E2E-005 Admin creates a room, and a guest can find it in search', async ({ page, browser, api, adminRooms, nav }) => {
    // Admin creates the room through the UI
    await loginAs(page, await api.loginAsAdmin());
    await adminRooms.open();
    await expect(nav.adminRooms).toBeVisible();

    const number = `A${randomBytes(3).toString('hex')}`;
    await adminRooms.createRoom({ number, type: 'SUITE', capacity: 5, pricePerNight: 222.22 });
    await expect(adminRooms.createdBanner).toHaveText(`Room ${number} created.`);
    await expect(adminRooms.row(number)).toBeVisible();
    await expect(adminRooms.status(number)).toHaveAttribute('data-status', 'ACTIVE');

    // A guest, in a separate browser session, finds it
    const guestContext = await browser.newContext();
    try {
      const guestPage = await guestContext.newPage();
      await loginAs(guestPage, await api.newGuest());
      const search = new SearchPage(guestPage);
      await search.open();
      await search.search({ checkIn: day(40), checkOut: day(42), guests: 5, type: 'SUITE' });
      await expect(search.roomCard(number)).toBeVisible();
      await expect(search.roomCard(number)).toContainText('SUITE');
    } finally {
      await guestContext.close();
    }
  });

  test('E2E-006 Guest cannot access the admin page [logged-in guest]', async ({ page, api, adminRooms, nav }) => {
    await loginAs(page, await api.newGuest());
    await adminRooms.open();

    await expect(adminRooms.accessDenied).toBeVisible();
    await expect(adminRooms.number).toHaveCount(0); // the create form is not rendered
    await expect(nav.myBookings).toBeVisible(); // logged in…
    await expect(nav.adminRooms).toHaveCount(0); // …but no admin link
  });

  test('E2E-006 Guest cannot access the admin page [not logged in]', async ({ page, adminRooms }) => {
    await adminRooms.open();

    await expect(page).toHaveURL(/\/login\?next=%2Fadmin%2Frooms/);
    await expect(page.getByTestId('login-page')).toBeVisible();
    await expect(adminRooms.number).toHaveCount(0);
  });
});
