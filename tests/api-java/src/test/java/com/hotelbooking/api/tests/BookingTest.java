package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Room;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.addDays;
import static com.hotelbooking.api.core.Dates.at;
import static com.hotelbooking.api.core.Dates.day;
import static com.hotelbooking.api.core.PriceOracle.expectedPrice;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Bookings")
class BookingTest extends BaseTest {

    /** Books OWN_ROOM as a fresh user, expects a 400 on `field`, and proves nothing was saved. */
    private Response expectRejected(BookingRequest.Builder change, String field) {
        Room room = data.createRoom();
        var user = data.freshUser();
        Response response = data.book(user.token(), change.apply(BookingRequest.forRoom(room.id())));
        assertError(response, 400, "VALIDATION_ERROR", field);
        assertThat(data.bookingsTotal(user.token())).isZero();
        return response;
    }

    @Test
    @Tag("smoke")
    @DisplayName("BOOK-001 Create a booking")
    void createBooking() {
        Room room = data.createRoom();
        BookingRequest request = BookingRequest.forRoom(room.id());
        Response response = bookings.create(tokens.g1(), request);
        assertOk(response, 201, "booking");
        Booking booking = response.as(Booking.class);
        assertThat(response.header("Location")).isEqualTo("/bookings/" + booking.id());
        assertThat(booking.roomId()).isEqualTo(room.id());
        assertThat(booking.userId()).isEqualTo(seed.g1().id());
        assertThat(booking.checkIn()).isEqualTo(request.checkIn());
        assertThat(booking.checkOut()).isEqualTo(request.checkOut());
        assertThat(booking.guests()).isEqualTo(1);
        assertThat(booking.status()).isEqualTo("CONFIRMED");
        assertThat(booking.paymentId()).isNotNull();
        assertThat(booking.cancelledAt()).isNull();
        assertThat(booking.totalPrice()).isPositive();

        Response read = bookings.request(tokens.g1()).get(response.header("Location"));
        assertOk(read, 200, "booking");
        assertThat(read.as(Booking.class)).isEqualTo(booking);
    }

    @Test
    @Tag("smoke")
    @DisplayName("BOOK-002 Owner reads own booking")
    void ownerReadsOwnBooking() {
        Room room = data.createRoom();
        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()));
        Response response = bookings.get(tokens.g1(), booking.id());
        assertOk(response, 200, "booking");
        assertThat(response.as(Booking.class)).isEqualTo(booking);
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-003 New booking appears in own list")
    void newBookingInOwnList() {
        Room room = data.createRoom();
        var user = data.freshUser();
        Booking booking = data.createBooking(user.token(), BookingRequest.forRoom(room.id()));
        assertThat(data.allBookings(user.token())).extracting(Booking::id).contains(booking.id());
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-004 checkIn in the past")
    void checkInInPast() {
        Response response = expectRejected(r -> r.withDates(day(-1), day(1)), "checkIn");
        assertThat(response.jsonPath().getString("error.message")).isEqualTo("checkIn cannot be in the past");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-005 checkIn today is allowed")
    void checkInToday() {
        Room room = data.createRoom();
        data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(day(0), day(1)));
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-006 \"Today\" follows UTC, to the second")
    void todayFollowsUtc() {
        String x = day(50);
        // (a) last second of day X: checkIn X is "today" → allowed
        Room roomA = data.createRoom();
        Response a = bookings.create(tokens.g1(), BookingRequest.forRoom(roomA.id()).withDates(x, addDays(x, 1)), at(x, "23:59:59"));
        assertOk(a, 201, "booking");
        // (b) first second of day X+1: checkIn X is "yesterday" → rejected
        Room roomB = data.createRoom();
        Response b = bookings.create(tokens.g1(), BookingRequest.forRoom(roomB.id()).withDates(x, addDays(x, 1)), at(addDays(x, 1), "00:00:00"));
        assertError(b, 400, "VALIDATION_ERROR", "checkIn");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-007 Same-day checkout")
    void sameDayCheckout() {
        Response response = expectRejected(r -> r.withDates(day(30), day(30)), "checkOut");
        assertThat(response.jsonPath().getString("error.message")).isEqualTo("checkOut must be after checkIn");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-008 checkOut before checkIn")
    void checkOutBeforeCheckIn() {
        expectRejected(r -> r.withDates(day(30), day(29)), "checkOut");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-009 30 nights is allowed")
    void thirtyNights() {
        Room room = data.createRoom();
        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(day(30), day(60)));
        assertThat(booking.totalPrice()).isEqualByComparingTo(expectedPrice(new BigDecimal("100"), day(30), day(60)));
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-010 31 nights is rejected")
    void thirtyOneNights() {
        Response response = expectRejected(r -> r.withDates(day(30), day(61)), "checkOut");
        assertThat(response.jsonPath().getString("error.message")).isEqualTo("Maximum stay is 30 nights");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-011 checkIn 365 days ahead is allowed")
    void checkIn365DaysAhead() {
        Room room = data.createRoom();
        data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(day(365), day(366)));
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-012 checkIn 366 days ahead is rejected")
    void checkIn366DaysAhead() {
        expectRejected(r -> r.withDates(day(366), day(367)), "checkIn");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-013 guests = 0")
    void zeroGuests() {
        expectRejected(r -> r.withGuests(0), "guests");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-014 guests = room capacity")
    void guestsEqualCapacity() {
        Room room = data.createRoom(); // capacity 2
        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withGuests(2));
        assertThat(booking.guests()).isEqualTo(2);
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-015 guests = capacity + 1")
    void guestsAboveCapacity() {
        expectRejected(r -> r.withGuests(3), "guests");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-016 Negative guests")
    void negativeGuests() {
        expectRejected(r -> r.withGuests(-1), "guests");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-017 Unknown room")
    void unknownRoom() {
        var user = data.freshUser();
        assertError(data.book(user.token(), BookingRequest.forRoom(UNKNOWN_ID)), 404, "NOT_FOUND");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-018 roomId is not a UUID")
    void roomIdNotUuid() {
        assertError(data.book(tokens.g1(), BookingRequest.forRoom("abc")), 400, "VALIDATION_ERROR", "roomId");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-019 Inactive room cannot be booked")
    void inactiveRoom() {
        var user = data.freshUser();
        assertError(data.book(user.token(), BookingRequest.forRoom(seed.room("302").id())), 409, "ROOM_INACTIVE");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-020 Get unknown booking")
    void getUnknownBooking() {
        assertError(bookings.get(tokens.g1(), UNKNOWN_ID), 404, "NOT_FOUND");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-021 Get booking with a non-UUID id")
    void getBookingNonUuid() {
        assertError(bookings.get(tokens.g1(), "abc"), 404, "NOT_FOUND");
    }

    @Test
    @Tag("regression")
    @DisplayName("BOOK-022 Booking list pagination")
    void bookingListPagination() {
        Room room = data.createRoom();
        var user = data.freshUser();
        for (int start : new int[] {30, 40, 50}) {
            data.createBooking(user.token(), BookingRequest.forRoom(room.id()).withDates(day(start), day(start + 1)));
        }
        Response page1 = bookings.list(user.token(), 1, 2);
        Response page2 = bookings.list(user.token(), 2, 2);
        assertOk(page1, 200, "booking-list");
        assertOk(page2, 200, "booking-list");
        assertThat(page1.jsonPath().getInt("total")).isEqualTo(3);
        List<String> ids1 = page1.jsonPath().getList("items.id");
        List<String> ids2 = page2.jsonPath().getList("items.id");
        assertThat(ids1).hasSize(2);
        assertThat(ids2).hasSize(1);
        var all = new HashSet<>(ids1);
        all.addAll(ids2);
        assertThat(all).hasSize(3);
    }
}
