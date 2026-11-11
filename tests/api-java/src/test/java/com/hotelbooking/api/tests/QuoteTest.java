package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Quote;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.RoomRequest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.Map;
import java.util.stream.Stream;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.day;
import static com.hotelbooking.api.core.Dates.monday;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Price quote")
class QuoteTest extends BaseTest {

    @Test
    @Tag("regression")
    @DisplayName("QUOTE-001 Quote lists the price of each night")
    void quoteListsEachNight() {
        Room room = data.createRoom(); // 100.00
        Response response = rooms.quote(room.id(), monday(3), monday(6)); // Thu, Fri, Sat; no token: public
        assertOk(response, 200, "quote");
        Quote quote = response.as(Quote.class);

        assertThat(quote.roomId()).isEqualTo(room.id());
        assertThat(quote.checkIn()).isEqualTo(monday(3));
        assertThat(quote.checkOut()).isEqualTo(monday(6));
        assertThat(quote.pricePerNight()).isEqualByComparingTo("100");
        assertThat(quote.nights()).extracting(Quote.Night::date).containsExactly(monday(3), monday(4), monday(5));
        assertThat(quote.nights()).extracting(Quote.Night::isWeekend).containsExactly(false, true, true);
        assertThat(quote.nights()).extracting(n -> n.price().stripTrailingZeros().toPlainString()).containsExactly("100", "120", "120");
        assertThat(quote.totalPrice()).isEqualByComparingTo("340");
    }

    @Test
    @Tag("regression")
    @DisplayName("QUOTE-002 Nightly prices are unrounded; only the total is rounded, and it matches the booking")
    void onlyTotalIsRounded() {
        Room room = data.createRoom(RoomRequest.newRoom().withPrice("33.33"));
        Response response = rooms.quote(room.id(), monday(4), monday(6));
        assertOk(response, 200, "quote");
        Quote quote = response.as(Quote.class);
        assertThat(quote.nights()).allSatisfy(n -> assertThat(n.price()).isEqualByComparingTo("39.996"));
        assertThat(quote.totalPrice()).isEqualByComparingTo("79.99");

        Booking booking = data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(monday(4), monday(6)));
        assertThat(booking.totalPrice()).isEqualByComparingTo(quote.totalPrice());
    }

    static Stream<Arguments> invalidDates() {
        return Stream.of(
                Arguments.of("checkIn in the past", Map.of("checkIn", day(-1), "checkOut", day(2)), "checkIn"),
                Arguments.of("same-day checkout", Map.of("checkIn", day(10), "checkOut", day(10)), "checkOut"),
                Arguments.of("31 nights", Map.of("checkIn", day(10), "checkOut", day(41)), "checkOut"),
                Arguments.of("checkIn 366 days ahead", Map.of("checkIn", day(366), "checkOut", day(367)), "checkIn"),
                Arguments.of("bad date format", Map.of("checkIn", "2026/12/01", "checkOut", day(41)), "checkIn"),
                Arguments.of("no checkOut", Map.of("checkIn", day(10)), "checkOut"));
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @Tag("regression")
    @DisplayName("QUOTE-003 Date rules apply to quotes")
    @MethodSource("invalidDates")
    void dateRulesApply(String name, Map<String, Object> query, String field) {
        Room room = data.createRoom();
        assertError(rooms.quote(room.id(), query), 400, "VALIDATION_ERROR", field);
    }

    @Test
    @Tag("regression")
    @DisplayName("QUOTE-004 Quote for an unknown room")
    void unknownRoom() {
        for (String id : new String[] {UNKNOWN_ID, "abc"}) {
            assertError(rooms.quote(id, day(100), day(101)), 404, "NOT_FOUND");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("QUOTE-005 Quote for an inactive room")
    void inactiveRoom() {
        assertError(rooms.quote(seed.room("302").id(), day(100), day(101)), 409, "ROOM_INACTIVE");
    }

    @Test
    @Tag("regression")
    @DisplayName("QUOTE-006 A quote is not an availability check")
    void quoteIsNotAvailabilityCheck() {
        Room room = data.createRoom();
        BookingRequest stay = BookingRequest.forRoom(room.id()).withDates(day(20), day(25));
        data.createBooking(data.freshUser().token(), stay);

        Response response = rooms.quote(room.id(), day(20), day(25));
        assertOk(response, 200, "quote");
        assertThat(response.as(Quote.class).nights()).hasSize(5);

        assertError(data.book(data.freshUser().token(), stay), 409, "ROOM_UNAVAILABLE");
    }
}
