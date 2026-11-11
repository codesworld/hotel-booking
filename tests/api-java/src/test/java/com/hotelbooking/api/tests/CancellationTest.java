package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.data.TestData.FreshUser;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Room;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Duration;
import java.time.Instant;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.checkInMoment;
import static com.hotelbooking.api.core.Dates.day;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Cancellation")
class CancellationTest extends BaseTest {

    /** Booking B by a fresh guest on OWN_ROOM. */
    private record BookingB(FreshUser owner, Booking booking) {}

    private BookingB bookingB(String checkIn, String checkOut) {
        Room room = data.createRoom();
        FreshUser owner = data.freshUser();
        Booking booking = data.createBooking(owner.token(), BookingRequest.forRoom(room.id()).withDates(checkIn, checkOut));
        return new BookingB(owner, booking);
    }

    private BookingB bookingB() {
        return bookingB(day(30), day(32));
    }

    @Test
    @Tag("smoke")
    @DisplayName("CANC-001 Owner cancels more than 48 h ahead")
    void ownerCancels() {
        BookingB b = bookingB();
        Response response = bookings.cancel(b.owner().token(), b.booking().id());
        assertOk(response, 200, "booking");
        assertThat(response.jsonPath().getString("status")).isEqualTo("CANCELLED");
        assertThat(response.jsonPath().getString("cancelledAt")).isNotNull();

        Booking read = data.getBooking(b.booking().id(), b.owner().token());
        assertThat(read.status()).isEqualTo("CANCELLED");
        assertThat(read.cancelledAt()).isEqualTo(response.jsonPath().getString("cancelledAt"));
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-002 Cancel an already cancelled booking")
    void cancelTwice() {
        BookingB b = bookingB();
        Response first = bookings.cancel(b.owner().token(), b.booking().id());
        assertOk(first, 200, "booking");

        assertError(bookings.cancel(b.owner().token(), b.booking().id()), 409, "ALREADY_CANCELLED");
        assertThat(data.getBooking(b.booking().id()).cancelledAt()).isEqualTo(first.jsonPath().getString("cancelledAt"));
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-003 Seeded cancelled booking cannot be cancelled again")
    void seededCancelledBooking() {
        assertError(bookings.cancel(tokens.g1(), seed.booking(2).id()), 409, "ALREADY_CANCELLED");
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-004 Guest cancels inside 48 h")
    void guestCancelsInside48h() {
        Booking sb6 = seed.booking(6);
        Response response = bookings.cancel(tokens.g2(), sb6.id());
        assertError(response, 422, "CANCELLATION_WINDOW_PASSED");
        assertThat(response.jsonPath().getString("error.message")).contains("48 hours");
        assertThat(data.getBooking(sb6.id()).status()).isEqualTo("CONFIRMED");
    }

    @ParameterizedTest(name = "{0} {1}")
    @Tag("regression")
    @DisplayName("CANC-005…007 48 h boundary")
    @CsvSource({
            // id, title, offset from CHECKIN(B) − 48h in seconds, expected status
            "CANC-005, '48 h boundary: exactly 48 h is too late',     0, 422",
            "CANC-006, '48 h boundary: 48 h + 1 s is allowed',        -1, 200",
            "CANC-007, '48 h boundary: 47 h 59 m 59 s is too late',   1, 422"})
    void cancellationBoundary(String id, String title, long offsetSeconds, int status) {
        BookingB b = bookingB();
        Instant now = checkInMoment(b.booking().checkIn()).minus(Duration.ofHours(48)).plusSeconds(offsetSeconds);
        Response response = bookings.cancel(b.owner().token(), b.booking().id(), now);

        if (status == 200) {
            assertOk(response, 200, "booking");
            assertThat(response.jsonPath().getString("status")).isEqualTo("CANCELLED");
        } else {
            assertError(response, 422, "CANCELLATION_WINDOW_PASSED");
            assertThat(data.getBooking(b.booking().id()).status()).isEqualTo("CONFIRMED");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-008 Admin cancels inside 48 h")
    void adminCancelsInside48h() {
        BookingB b = bookingB(day(1), day(2));
        Response response = bookings.cancel(tokens.admin(), b.booking().id());
        assertOk(response, 200, "booking");
        assertThat(response.jsonPath().getString("status")).isEqualTo("CANCELLED");
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-009 Admin cancels another user's booking")
    void adminCancelsOthersBooking() {
        BookingB b = bookingB();
        Response response = bookings.cancel(tokens.admin(), b.booking().id());
        assertOk(response, 200, "booking");
        assertThat(response.jsonPath().getString("status")).isEqualTo("CANCELLED");
        assertThat(response.jsonPath().getString("userId")).isEqualTo(b.owner().id());
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-010 Guest cannot cancel after check-in")
    void guestCannotCancelAfterCheckIn() {
        BookingB b = bookingB();
        Instant now = checkInMoment(b.booking().checkIn()).plus(Duration.ofHours(1));
        assertError(bookings.cancel(b.owner().token(), b.booking().id(), now), 422, "CANCELLATION_WINDOW_PASSED");
        assertThat(data.getBooking(b.booking().id()).status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-011 Failed-payment booking cannot be cancelled")
    void failedPaymentNotCancellable() {
        Booking sb4 = seed.booking(4);
        assertError(bookings.cancel(tokens.g2(), sb4.id()), 409, "BOOKING_NOT_CANCELLABLE");
        assertThat(data.getBooking(sb4.id()).status()).isEqualTo("PAYMENT_FAILED");
    }

    @Test
    @Tag("regression")
    @DisplayName("CANC-012 Cancel an unknown booking")
    void cancelUnknownBooking() {
        assertError(bookings.cancel(tokens.g1(), UNKNOWN_ID), 404, "NOT_FOUND");
    }
}
