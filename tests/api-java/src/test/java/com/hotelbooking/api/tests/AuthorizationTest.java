package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.RoomRequest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Map;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Authorization")
class AuthorizationTest extends BaseTest {

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-001 Guest cannot create a room")
    void guestCannotCreateRoom() {
        RoomRequest room = RoomRequest.newRoom();
        assertError(rooms.create(tokens.g1(), room), 403, "FORBIDDEN");
        assertThat(data.roomNumberExists(room.number())).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-002 Guest cannot replace a room")
    void guestCannotReplaceRoom() {
        Room room = data.createRoom();
        assertError(rooms.replace(tokens.g1(), room.id(), RoomRequest.newRoom().withPrice("1")), 403, "FORBIDDEN");
        assertThat(data.getRoom(room.id())).isEqualTo(room);
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-003 Guest cannot patch/deactivate a room")
    void guestCannotPatchRoom() {
        Room room = data.createRoom();
        assertError(rooms.patch(tokens.g1(), room.id(), Map.of("isActive", false)), 403, "FORBIDDEN");
        assertThat(data.getRoom(room.id()).isActive()).isTrue();
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("AUTHZ-004 Room write endpoints require a token")
    @ValueSource(strings = {"POST", "PUT", "PATCH"})
    void roomWritesRequireToken(String method) {
        Room room = data.createRoom();
        RoomRequest newRoom = RoomRequest.newRoom();
        Response response = switch (method) {
            case "POST" -> rooms.create(null, newRoom);
            case "PUT" -> rooms.replace(null, room.id(), newRoom);
            default -> rooms.patch(null, room.id(), Map.of("isActive", false));
        };
        assertError(response, 401, "AUTH_REQUIRED");
        assertThat(data.getRoom(room.id())).isEqualTo(room);
        if (method.equals("POST")) assertThat(data.roomNumberExists(newRoom.number())).isFalse();
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("AUTHZ-005 Booking endpoints require a token")
    @ValueSource(strings = {"POST /bookings", "GET /bookings", "GET /bookings/{id}", "POST /bookings/{id}/cancel"})
    void bookingEndpointsRequireToken(String endpoint) {
        Booking sb1 = seed.booking(1);
        Response response = switch (endpoint) {
            case "POST /bookings" -> bookings.create(null, BookingRequest.forRoom(seed.room("202").id()));
            case "GET /bookings" -> bookings.list(null);
            case "GET /bookings/{id}" -> bookings.get(null, sb1.id());
            default -> bookings.cancel(null, sb1.id());
        };
        assertError(response, 401, "AUTH_REQUIRED");
        assertThat(data.getBooking(sb1.id()).status()).isEqualTo("CONFIRMED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-006 Guest sees only own bookings")
    void guestSeesOnlyOwnBookings() {
        var list = data.allBookings(tokens.g2());
        assertThat(list).allMatch(b -> b.userId().equals(seed.g2().id()));
        var ids = list.stream().map(Booking::id).toList();
        assertThat(ids).contains(seed.booking(4).id(), seed.booking(5).id(), seed.booking(6).id());
        assertThat(ids).doesNotContain(seed.booking(1).id(), seed.booking(2).id(), seed.booking(3).id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-007 Admin sees all bookings")
    void adminSeesAllBookings() {
        var ids = data.allBookings(tokens.admin()).stream().map(Booking::id).toList();
        for (int n = 1; n <= 6; n++) assertThat(ids).contains(seed.booking(n).id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-008 Guest cannot read another guest's booking")
    void guestCannotReadOthersBooking() {
        assertError(bookings.get(tokens.g2(), seed.booking(1).id()), 403, "FORBIDDEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-009 Guest cannot cancel another guest's booking")
    void guestCannotCancelOthersBooking() {
        Booking sb1 = seed.booking(1);
        assertError(bookings.cancel(tokens.g2(), sb1.id()), 403, "FORBIDDEN");
        Booking after = data.getBooking(sb1.id());
        assertThat(after.status()).isEqualTo("CONFIRMED");
        assertThat(after.cancelledAt()).isNull();
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-010 Admin can read any booking")
    void adminReadsAnyBooking() {
        Response response = bookings.get(tokens.admin(), seed.booking(1).id());
        assertOk(response, 200, "booking");
        assertThat(response.jsonPath().getString("userId")).isEqualTo(seed.g1().id());
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-011 includeInactive is ignored for guests and anonymous users")
    void includeInactiveIgnoredForNonAdmins() {
        for (String token : new String[] {tokens.g1(), null}) {
            var numbers = data.allRooms(Map.of("includeInactive", "true"), token).stream().map(Room::number).toList();
            assertThat(numbers).doesNotContain("302");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-012 Admin can list inactive rooms")
    void adminListsInactiveRooms() {
        var r302 = data.allRooms(Map.of("includeInactive", "true"), tokens.admin()).stream()
                .filter(r -> r.number().equals("302")).findFirst();
        assertThat(r302).isPresent();
        assertThat(r302.get().isActive()).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTHZ-013 New guest cannot see seeded bookings")
    void newGuestSeesNothing() {
        var user = data.freshUser();
        Response response = bookings.list(user.token());
        assertOk(response, 200, "booking-list");
        assertThat(response.jsonPath().getInt("total")).isZero();
        assertThat(response.jsonPath().getList("items")).isEmpty();
    }
}
