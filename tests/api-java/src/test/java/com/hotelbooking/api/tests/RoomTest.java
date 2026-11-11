package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.RoomRequest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Map;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.at;
import static com.hotelbooking.api.core.Dates.day;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Rooms")
class RoomTest extends BaseTest {

    private static final Map<String, Object> NO_FILTER = Map.of();

    private java.util.List<String> publicRoomIds() {
        return data.allRooms(NO_FILTER, null).stream().map(Room::id).toList();
    }

    @Test
    @Tag("smoke")
    @DisplayName("ROOM-001 Public room list shows only active rooms")
    void publicListActiveOnly() {
        var list = data.allRooms(NO_FILTER, null);
        assertThat(list).allMatch(Room::isActive);
        assertThat(list).extracting(Room::number).contains("101", "102", "201", "202", "301").doesNotContain("302");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-002 Filter by type")
    void filterByType() {
        assertOk(rooms.list(Map.of("type", "SUITE"), null), 200, "room-list");
        var suites = data.allRooms(Map.of("type", "SUITE"), null);
        assertThat(suites).allMatch(r -> r.type().equals("SUITE"));
        assertThat(suites).extracting(Room::number).contains("301");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-003 Pagination")
    void pagination() {
        // type=SINGLE: no other test creates SINGLE rooms, so this list is stable (R101, R102).
        Response page1 = rooms.list(Map.of("type", "SINGLE", "limit", 1, "page", 1), null);
        Response page2 = rooms.list(Map.of("type", "SINGLE", "limit", 1, "page", 2), null);
        assertOk(page1, 200, "room-list");
        assertOk(page2, 200, "room-list");
        assertThat(page1.jsonPath().getInt("page")).isEqualTo(1);
        assertThat(page2.jsonPath().getInt("page")).isEqualTo(2);
        assertThat(page1.jsonPath().getInt("limit")).isEqualTo(1);
        assertThat(page1.jsonPath().getList("items")).hasSize(1);
        assertThat(page2.jsonPath().getList("items")).hasSize(1);
        assertThat(page1.jsonPath().getString("items[0].id")).isNotEqualTo(page2.jsonPath().getString("items[0].id"));
        assertThat(page1.jsonPath().getInt("total")).isEqualTo(page2.jsonPath().getInt("total"));
    }

    @Test
    @Tag("smoke")
    @DisplayName("ROOM-004 Get room by id")
    void getRoomById() {
        Response response = rooms.get(seed.room("101").id());
        assertOk(response, 200, "room");
        Room room = response.as(Room.class);
        assertThat(room.number()).isEqualTo("101");
        assertThat(room.type()).isEqualTo("SINGLE");
        assertThat(room.capacity()).isEqualTo(1);
        assertThat(room.pricePerNight()).isEqualByComparingTo("80");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-005 Get unknown room")
    void getUnknownRoom() {
        assertError(rooms.get(UNKNOWN_ID), 404, "NOT_FOUND");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-006 Get room with a non-UUID id")
    void getRoomNonUuid() {
        assertError(rooms.get("abc"), 404, "NOT_FOUND");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-007 Inactive room is readable by id")
    void inactiveRoomReadable() {
        Response response = rooms.get(seed.room("302").id());
        assertOk(response, 200, "room");
        assertThat(response.jsonPath().getBoolean("isActive")).isFalse();
    }

    @Test
    @Tag("smoke")
    @DisplayName("ROOM-008 Admin creates a room")
    void adminCreatesRoom() {
        RoomRequest request = RoomRequest.newRoom();
        Response response = rooms.create(tokens.admin(), request);
        assertOk(response, 201, "room");
        Room created = response.as(Room.class);
        assertThat(response.header("Location")).isEqualTo("/rooms/" + created.id());
        assertThat(created.number()).isEqualTo(request.number());
        assertThat(created.type()).isEqualTo(request.type());
        assertThat(created.capacity()).isEqualTo(request.capacity());
        assertThat(created.pricePerNight()).isEqualByComparingTo(request.pricePerNight());
        assertThat(created.isActive()).isTrue();

        Response read = rooms.request(null).get(response.header("Location"));
        assertOk(read, 200, "room");
        assertThat(read.as(Room.class)).isEqualTo(created);
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-009 Admin creates an inactive room")
    void adminCreatesInactiveRoom() {
        Room room = data.createRoom(RoomRequest.newRoom().withActive(false));
        assertThat(room.isActive()).isFalse();
        assertThat(publicRoomIds()).doesNotContain(room.id());
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-010 Duplicate room number")
    void duplicateRoomNumber() {
        Room room = data.createRoom();
        var duplicate = RoomRequest.newRoom().withNumber(room.number()).withType("SUITE").withCapacity(5).withPrice("300");
        assertError(rooms.create(tokens.admin(), duplicate), 409, "ROOM_NUMBER_TAKEN");
        assertThat(data.getRoom(room.id())).isEqualTo(room);
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-011 Replace room (PUT)")
    void replaceRoom() {
        Room room = data.createRoom();
        var replacement = RoomRequest.newRoom().withType("SUITE").withCapacity(4).withPrice("199.99");
        Response response = rooms.replace(tokens.admin(), room.id(), replacement);
        assertOk(response, 200, "room");
        Room expected = new Room(room.id(), replacement.number(), "SUITE", 4, new BigDecimal("199.99"), true);
        assertThat(response.as(Room.class)).usingRecursiveComparison().withComparatorForType(BigDecimal::compareTo, BigDecimal.class).isEqualTo(expected);
        assertThat(data.getRoom(room.id())).isEqualTo(response.as(Room.class));
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-012 PUT rejects isActive")
    void putRejectsIsActive() {
        Room room = data.createRoom();
        assertError(rooms.replace(tokens.admin(), room.id(), RoomRequest.newRoom().withActive(false)), 400, "VALIDATION_ERROR", "isActive");
        assertThat(data.getRoom(room.id())).isEqualTo(room);
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-013 PUT with a partial body")
    void putPartialBody() {
        Room room = data.createRoom();
        assertError(rooms.replace(tokens.admin(), room.id(), Map.of("pricePerNight", 50)), 400, "VALIDATION_ERROR");
        assertThat(data.getRoom(room.id()).pricePerNight()).isEqualByComparingTo("100");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-014 PUT to a number that already exists")
    void putDuplicateNumber() {
        Room room = data.createRoom();
        assertError(rooms.replace(tokens.admin(), room.id(), RoomRequest.newRoom().withNumber("101")), 409, "ROOM_NUMBER_TAKEN");
        assertThat(data.getRoom(room.id()).number()).isEqualTo(room.number());
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-015 PUT unknown room")
    void putUnknownRoom() {
        RoomRequest request = RoomRequest.newRoom();
        assertError(rooms.replace(tokens.admin(), UNKNOWN_ID, request), 404, "NOT_FOUND");
        assertThat(data.roomNumberExists(request.number())).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-016 PATCH a single field")
    void patchSingleField() {
        Room room = data.createRoom();
        Response response = rooms.patch(tokens.admin(), room.id(), Map.of("pricePerNight", 150));
        assertOk(response, 200, "room");
        Room patched = response.as(Room.class);
        assertThat(patched.pricePerNight()).isEqualByComparingTo("150");
        assertThat(patched).usingRecursiveComparison().ignoringFields("pricePerNight").isEqualTo(room);
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-017 PATCH with an empty body")
    void patchEmptyBody() {
        Room room = data.createRoom();
        assertError(rooms.patch(tokens.admin(), room.id(), Map.of()), 400, "VALIDATION_ERROR");
        assertThat(data.getRoom(room.id())).isEqualTo(room);
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-018 PATCH unknown room")
    void patchUnknownRoom() {
        assertError(rooms.patch(tokens.admin(), UNKNOWN_ID, Map.of("pricePerNight", 150)), 404, "NOT_FOUND");
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-019 PATCH to a number that already exists")
    void patchDuplicateNumber() {
        Room room = data.createRoom();
        assertError(rooms.patch(tokens.admin(), room.id(), Map.of("number", "101")), 409, "ROOM_NUMBER_TAKEN");
        assertThat(data.getRoom(room.id()).number()).isEqualTo(room.number());
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-020 Deactivate a room without bookings")
    void deactivateRoomWithoutBookings() {
        Room room = data.createRoom();
        Response response = rooms.patch(tokens.admin(), room.id(), Map.of("isActive", false));
        assertOk(response, 200, "room");
        assertThat(response.jsonPath().getBoolean("isActive")).isFalse();
        assertThat(publicRoomIds()).doesNotContain(room.id());
        assertThat(data.availableRoomIds(Map.of("checkIn", day(100), "checkOut", day(101)))).doesNotContain(room.id());
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-021 Cannot deactivate a room with future confirmed bookings")
    void cannotDeactivateWithFutureBookings() {
        Room r301 = seed.room("301");
        assertError(rooms.patch(tokens.admin(), r301.id(), Map.of("isActive", false)), 409, "ROOM_HAS_FUTURE_BOOKINGS");
        assertThat(data.getRoom(r301.id()).isActive()).isTrue();
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-022 Cancelled / failed bookings do not prevent deactivation")
    void cancelledAndFailedBookingsDoNotBlockDeactivation() {
        Room room = data.createRoom();
        var user = data.freshUser();
        assertError(data.book(user.token(), BookingRequest.forRoom(room.id()).withCardToken("tok_decline")), 402, "PAYMENT_DECLINED");
        var booking = data.createBooking(user.token(), BookingRequest.forRoom(room.id()).withDates(day(40), day(42)));
        assertOk(bookings.cancel(user.token(), booking.id()), 200, "booking");

        Response response = rooms.patch(tokens.admin(), room.id(), Map.of("isActive", false));
        assertOk(response, 200, "room");
        assertThat(response.jsonPath().getBoolean("isActive")).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-023 Past confirmed bookings do not prevent deactivation")
    void pastBookingsDoNotBlockDeactivation() {
        Room room = data.createRoom();
        data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(day(5), day(7)));
        Response response = rooms.patch(tokens.admin(), room.id(), Map.of("isActive", false), at(day(8), "12:00:00"));
        assertOk(response, 200, "room");
        assertThat(response.jsonPath().getBoolean("isActive")).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-024 Ongoing stay prevents deactivation")
    void ongoingStayBlocksDeactivation() {
        Room room = data.createRoom();
        data.createBooking(tokens.g1(), BookingRequest.forRoom(room.id()).withDates(day(5), day(7)));
        Response response = rooms.patch(tokens.admin(), room.id(), Map.of("isActive", false), at(day(6), "12:00:00"));
        assertError(response, 409, "ROOM_HAS_FUTURE_BOOKINGS");
        assertThat(data.getRoom(room.id()).isActive()).isTrue();
    }

    @Test
    @Tag("regression")
    @DisplayName("ROOM-025 Reactivate a room")
    void reactivateRoom() {
        Room room = data.createRoom(RoomRequest.newRoom().withActive(false));
        Response response = rooms.patch(tokens.admin(), room.id(), Map.of("isActive", true));
        assertOk(response, 200, "room");
        assertThat(response.jsonPath().getBoolean("isActive")).isTrue();
        assertThat(publicRoomIds()).contains(room.id());
    }
}
