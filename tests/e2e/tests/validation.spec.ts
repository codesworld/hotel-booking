// Critical flow 4: validation messages on the booking form.
// The messages come from the API and appear under the field they belong to.
import { test, expect, loginAs } from '../src/fixtures';
import { day } from '../src/api';

test.describe('Booking form validation', () => {
  test.beforeEach(async ({ page, api, roomPage }) => {
    const admin = await api.loginAsAdmin();
    const room = await api.createRoom(admin);
    await loginAs(page, await api.newGuest());
    await roomPage.open(room.id, { checkIn: day(30), checkOut: day(32) });
    await expect(roomPage.priceTotal).toBeVisible(); // valid dates: no errors yet
  });

  test('E2E-004 Validation messages on the booking form [past date]', async ({ api, roomPage, myBookings }) => {
    await roomPage.setDates(day(-2), day(1));

    await expect(roomPage.fieldError('checkIn')).toHaveText('checkIn cannot be in the past');
    await expect(roomPage.priceBreakdown).toHaveCount(0);

    // Submitting anyway is rejected by the API with the same message; nothing is booked
    await roomPage.book('tok_success');
    await expect(roomPage.fieldError('checkIn')).toHaveText('checkIn cannot be in the past');
    await myBookings.open();
    await expect(myBookings.rows).toHaveCount(0);
  });

  test('E2E-004 Validation messages on the booking form [checkout before checkin]', async ({ roomPage, myBookings }) => {
    await roomPage.setDates(day(30), day(28));

    await expect(roomPage.fieldError('checkOut')).toHaveText('checkOut must be after checkIn');
    await expect(roomPage.priceBreakdown).toHaveCount(0);

    await roomPage.book('tok_success');
    await expect(roomPage.fieldError('checkOut')).toHaveText('checkOut must be after checkIn');
    await myBookings.open();
    await expect(myBookings.rows).toHaveCount(0);
  });

  test('E2E-004 Validation messages on the booking form [message clears when fixed]', async ({ roomPage }) => {
    await roomPage.setDates(day(30), day(28));
    await expect(roomPage.fieldError('checkOut')).toBeVisible();

    await roomPage.setDates(day(30), day(32));
    await expect(roomPage.fieldError('checkOut')).toHaveCount(0);
    await expect(roomPage.priceTotal).toBeVisible();
  });
});
