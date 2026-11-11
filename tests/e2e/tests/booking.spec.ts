// Critical flows 1 and 2: booking with an approved and a declined payment.
import { test, expect, loginAs } from '../src/fixtures';
import { day, money } from '../src/api';

test.describe('Booking', () => {
  test('E2E-001 Guest searches, books, and sees the booking as CONFIRMED', async ({ page, api, searchPage, roomPage, myBookings }) => {
    // Setup (API): a room of our own and a fresh guest, logged in without the form
    const admin = await api.loginAsAdmin();
    const room = await api.createRoom(admin, { type: 'DOUBLE', capacity: 2, pricePerNight: 100 });
    const guest = await api.newGuest();
    await loginAs(page, guest);
    const stay = { checkIn: day(30), checkOut: day(33) };
    const expectedTotal = money(await api.quoteTotal(room.id, stay.checkIn, stay.checkOut));

    // Search
    await searchPage.open();
    await searchPage.search({ ...stay, guests: 2, type: 'DOUBLE' });
    await expect(searchPage.roomCard(room.number)).toBeVisible();
    await expect(searchPage.roomTotal(room.number)).toHaveText(expectedTotal);

    // Room details: price breakdown for 3 nights
    await searchPage.openRoom(room.number);
    await expect(roomPage.title).toHaveText(`Room ${room.number}`);
    await expect(roomPage.priceBreakdown.locator('tbody tr')).toHaveCount(3);
    await expect(roomPage.priceTotal).toHaveText(expectedTotal);

    // Book with an approved test card
    await roomPage.book('tok_success');

    // My bookings: the new booking is CONFIRMED
    await expect(page).toHaveURL(/\/bookings\?created=/);
    await expect(myBookings.createdBanner).toBeVisible();
    const bookingId = myBookings.createdBookingId();
    await expect(myBookings.status(bookingId)).toHaveAttribute('data-status', 'CONFIRMED');
    await expect(myBookings.room(bookingId)).toHaveText(room.number);
    await expect(myBookings.total(bookingId)).toHaveText(expectedTotal);

    // The UI tells the truth: the API agrees
    expect((await api.getBooking(guest, bookingId)).status).toBe('CONFIRMED');
  });

  test('E2E-002 Declined payment shows an error and the booking appears as PAYMENT_FAILED', async ({ page, api, roomPage, myBookings }) => {
    const admin = await api.loginAsAdmin();
    const room = await api.createRoom(admin);
    const guest = await api.newGuest();
    await loginAs(page, guest);

    await roomPage.open(room.id, { checkIn: day(30), checkOut: day(32) });
    await expect(roomPage.priceTotal).toBeVisible();
    await roomPage.book('tok_decline');

    // Clear error on the room page; the user stays there
    await expect(roomPage.bookingError).toBeVisible();
    await expect(roomPage.bookingErrorMessage).toContainText('declined');
    await expect(page).toHaveURL(new RegExp(`/rooms/${room.id}`));

    // The failed attempt is listed as PAYMENT_FAILED
    await roomPage.bookingsLinkInError.click();
    await expect(myBookings.rows).toHaveCount(1);
    await expect(myBookings.rows.first()).toHaveAttribute('data-status', 'PAYMENT_FAILED');

    const [booking] = await api.myBookings(guest);
    expect(booking.status).toBe('PAYMENT_FAILED');
    await expect(myBookings.cancelButton(booking.id)).toHaveCount(0); // failed bookings cannot be cancelled
  });
});
