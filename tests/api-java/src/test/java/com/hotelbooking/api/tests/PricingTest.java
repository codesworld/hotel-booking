package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.model.AvailableRoom;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.RoomRequest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;
import java.util.Map;

import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.monday;
import static com.hotelbooking.api.core.PriceOracle.expectedPrice;
import static org.assertj.core.api.Assertions.assertThat;

/** OWN_ROOM costs 100.00 per night unless stated. monday(n) = MON+n; MON+4 is a Friday. */
@Epic("API")
@Feature("Pricing")
class PricingTest extends BaseTest {

    @ParameterizedTest(name = "{0} {1}")
    @Tag("regression")
    @DisplayName("PRICE-001…007 Stay price")
    @CsvSource({
            // id,      title,                               price, from, to, expected
            "PRICE-001, Weekday-only stay,                     100,   0, 3, 300.00",
            "PRICE-002, Stay including Friday and Saturday,    100,   3, 6, 340.00",
            "PRICE-003, Friday night only,                     100,   4, 5, 120.00",
            "PRICE-004, Sunday night is not weekend,           100,   6, 7, 100.00",
            "PRICE-005, Full week,                             100,   0, 7, 740.00",
            "PRICE-006, Rounding down,                       33.33,   4, 6,  79.99",
            "PRICE-007, Rounding up,                         33.34,   4, 6,  80.02"})
    void stayPrice(String id, String title, String price, int from, int to, String expected) {
        // sanity check of the test's own expectation against the independent oracle
        assertThat(expectedPrice(new BigDecimal(price), monday(from), monday(to))).isEqualByComparingTo(expected);

        Room room = data.createRoom(RoomRequest.newRoom().withPrice(price));
        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(monday(from), monday(to)));
        assertThat(booking.totalPrice()).isEqualByComparingTo(expected);
    }

    @Test
    @Tag("regression")
    @DisplayName("PRICE-008 Availability price equals booking price")
    void availabilityPriceEqualsBookingPrice() {
        Room room = data.createRoom();
        AvailableRoom offered = data.allAvailable(Map.of("checkIn", monday(2), "checkOut", monday(6))).stream()
                .filter(r -> r.id().equals(room.id())).findFirst().orElseThrow();
        assertThat(offered.totalPrice()).isEqualByComparingTo("440.00");

        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(monday(2), monday(6)));
        assertThat(booking.totalPrice()).isEqualByComparingTo(offered.totalPrice());
    }

    @Test
    @Tag("regression")
    @DisplayName("PRICE-009 Price change does not affect existing bookings")
    void priceChangeDoesNotAffectExistingBookings() {
        Room room = data.createRoom();
        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(monday(0), monday(3)));
        assertThat(booking.totalPrice()).isEqualByComparingTo("300.00");

        assertOk(rooms.patch(tokens.admin(), room.id(), Map.of("pricePerNight", 500)), 200, "room");
        assertThat(data.getBooking(booking.id()).totalPrice()).isEqualByComparingTo("300.00");
    }
}
