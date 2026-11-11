package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.data.TestData.FreshUser;
import com.hotelbooking.api.model.AvailableRoom;
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

import java.util.HashMap;
import java.util.Map;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.day;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Availability")
class AvailabilityTest extends BaseTest {

    /** OWN_ROOM with one CONFIRMED booking E = D+20 → D+25 (catalog section 2.6). */
    private record RoomWithE(Room room, FreshUser owner, Booking e) {}

    private RoomWithE roomWithBookingE() {
        Room room = data.createRoom();
        FreshUser owner = data.freshUser();
        Booking e = data.createBooking(owner.token(), BookingRequest.forRoom(room.id()).withDates(day(20), day(25)));
        return new RoomWithE(room, owner, e);
    }

    private static Map<String, Object> search(int checkIn, int checkOut) {
        Map<String, Object> query = new HashMap<>();
        query.put("checkIn", day(checkIn));
        query.put("checkOut", day(checkOut));
        return query;
    }

    private static Map<String, Object> search(int checkIn, int checkOut, String key, Object value) {
        Map<String, Object> query = search(checkIn, checkOut);
        query.put(key, value);
        return query;
    }

    private BookingRequest stay(Room room, int from, int to) {
        return BookingRequest.forRoom(room.id()).withDates(day(from), day(to));
    }

    @Test
    @Tag("smoke")
    @DisplayName("AVAIL-001 Search returns free rooms with stay price")
    void searchReturnsFreeRooms() {
        assertOk(rooms.availability(search(100, 103)), 200, "availability-list");
        var available = data.allAvailable(search(100, 103));
        assertThat(available).allSatisfy(r -> {
            assertThat(r.isActive()).isTrue();
            assertThat(r.nights()).isEqualTo(3);
            assertThat(r.totalPrice()).isPositive();
        });
        assertThat(available).extracting(AvailableRoom::number).doesNotContain("302");
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-002 Booked room is not returned for overlapping dates")
    void bookedRoomNotReturned() {
        var setup = roomWithBookingE();
        assertThat(data.availableRoomIds(search(21, 23))).doesNotContain(setup.room().id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-003 Room free from the checkout day (back-to-back)")
    void freeFromCheckoutDay() {
        var setup = roomWithBookingE();
        assertThat(data.availableRoomIds(search(25, 27))).contains(setup.room().id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-004 Room free until the check-in day")
    void freeUntilCheckInDay() {
        var setup = roomWithBookingE();
        assertThat(data.availableRoomIds(search(18, 20))).contains(setup.room().id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-005 Guests filter excludes small rooms")
    void guestsFilter() {
        Room room = data.createRoom(); // capacity 2
        var forThree = data.allAvailable(search(100, 101, "guests", 3));
        assertThat(forThree).extracting(AvailableRoom::id).doesNotContain(room.id());
        assertThat(forThree).allMatch(r -> r.capacity() >= 3);
        assertThat(data.availableRoomIds(search(100, 101, "guests", 2))).contains(room.id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-006 Type filter")
    void typeFilter() {
        var singles = data.allAvailable(search(100, 101, "type", "SINGLE"));
        assertThat(singles).isNotEmpty().allMatch(r -> r.type().equals("SINGLE"));
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-007 Inactive rooms are never returned")
    void inactiveNeverReturned() {
        assertThat(data.availableRoomIds(search(100, 101))).doesNotContain(seed.room("302").id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-008 Seeded statuses: blocking vs non-blocking")
    void seededStatuses() {
        // SB3 PENDING_PAYMENT blocks R102
        assertThat(data.availableRoomIds(search(40, 42))).doesNotContain(seed.room("102").id());
        // SB2 CANCELLED does not block R202
        assertThat(data.availableRoomIds(search(20, 22))).contains(seed.room("202").id());
        // SB4 PAYMENT_FAILED does not block R101
        assertThat(data.availableRoomIds(search(5, 7))).contains(seed.room("101").id());
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @Tag("regression")
    @DisplayName("AVAIL-009 Date rules apply to search")
    @CsvSource({
            "checkIn in the past, -1, 2, checkIn",
            "same-day checkout, 10, 10, checkOut",
            "31 nights, 10, 41, checkOut",
            "checkIn 366 days ahead, 366, 367, checkIn"})
    void dateRulesApplyToSearch(String name, int checkIn, int checkOut, String field) {
        assertError(rooms.availability(search(checkIn, checkOut)), 400, "VALIDATION_ERROR", field);
    }

    @ParameterizedTest(name = "{0} Overlap: {1}")
    @Tag("regression")
    @DisplayName("AVAIL-010…014 Overlapping stays are rejected")
    @CsvSource({
            "AVAIL-010, identical dates, 20, 25",
            "AVAIL-011, partial at the start, 18, 21",
            "AVAIL-012, partial at the end, 24, 27",
            "AVAIL-013, new stay inside the existing one, 21, 23",
            "AVAIL-014, new stay encloses the existing one, 19, 26"})
    void overlapRejected(String id, String name, int from, int to) {
        var setup = roomWithBookingE();
        FreshUser other = data.freshUser();
        assertError(data.book(other.token(), stay(setup.room(), from, to)), 409, "ROOM_UNAVAILABLE");
        assertThat(data.bookingsTotal(other.token())).isZero();
        assertThat(data.getBooking(setup.e().id()).status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-015 Back-to-back after: check-in on the checkout day")
    void backToBackAfter() {
        var setup = roomWithBookingE();
        Booking booking = data.createBooking(data.freshUser().token(), stay(setup.room(), 25, 27));
        assertThat(booking.status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-016 Back-to-back before: checkout on the check-in day")
    void backToBackBefore() {
        var setup = roomWithBookingE();
        Booking booking = data.createBooking(data.freshUser().token(), stay(setup.room(), 18, 20));
        assertThat(booking.status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-017 Cancelled booking frees the room")
    void cancelledBookingFreesRoom() {
        var setup = roomWithBookingE();
        assertOk(bookings.cancel(setup.owner().token(), setup.e().id()), 200, "booking");
        Booking booking = data.createBooking(data.freshUser().token(), stay(setup.room(), 20, 25));
        assertThat(booking.status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-018 Failed payment does not block the room")
    void failedPaymentDoesNotBlock() {
        Room room = data.createRoom();
        Response declined = data.book(data.freshUser().token(), stay(room, 20, 25).withCardToken("tok_decline"));
        assertError(declined, 402, "PAYMENT_DECLINED");
        assertThat(data.getBooking(declined.jsonPath().getString("error.details.bookingId")).status()).isEqualTo("PAYMENT_FAILED");

        Booking booking = data.createBooking(data.freshUser().token(), stay(room, 20, 25));
        assertThat(booking.status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-019 Pending payment blocks the room")
    void pendingPaymentBlocks() {
        FreshUser user = data.freshUser();
        assertError(data.book(user.token(), stay(seed.room("102"), 40, 42)), 409, "ROOM_UNAVAILABLE");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("AVAIL-020 Same dates in a different room are fine")
    void sameDatesDifferentRoom() {
        roomWithBookingE();
        Room room2 = data.createRoom();
        data.createBooking(data.freshUser().token(), stay(room2, 20, 25));
    }
}
