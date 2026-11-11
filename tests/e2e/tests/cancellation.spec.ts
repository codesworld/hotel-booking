// Critical flow 3: a guest cancels a booking.
import { test, expect, loginAs } from '../src/fixtures';
import { day } from '../src/api';

test.describe('Cancellation', () => {
  test('E2E-003 Guest cancels a booking', async ({ page, api, myBookings }) => {
    // Setup (API): a confirmed booking more than 48 h ahead
    const admin = await api.loginAsAdmin();
    const room = await api.createRoom(admin);
    const guest = await api.newGuest();
    const booking = await api.createBooking(guest, room.id, day(30), day(32));
    await loginAs(page, guest);

    await myBookings.open();
    await expect(myBookings.status(booking.id)).toHaveAttribute('data-status', 'CONFIRMED');

    await myBookings.cancel(booking.id);

    await expect(myBookings.status(booking.id)).toHaveAttribute('data-status', 'CANCELLED');
    await expect(myBookings.cancelButton(booking.id)).toHaveCount(0);
    expect((await api.getBooking(guest, booking.id)).status).toBe('CANCELLED');

    // Still cancelled after a reload (it was saved, not just changed on screen)
    await page.reload();
    await expect(myBookings.status(booking.id)).toHaveAttribute('data-status', 'CANCELLED');
  });
});
