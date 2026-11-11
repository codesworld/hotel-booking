package com.hotelbooking.api.data;

import com.hotelbooking.api.clients.AuthClient;
import com.hotelbooking.api.clients.BookingClient;
import com.hotelbooking.api.clients.RoomClient;
import com.hotelbooking.api.model.AvailableRoom;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.RegisterRequest;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.RoomRequest;
import io.restassured.response.Response;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.ApiAssertions.assertStatus;

/**
 * Creates the test's OWN data (rooms, users, bookings) and reads lists.
 * Names follow the catalog: OWN_ROOM, NEW_USER, BOOKING.
 */
public class TestData {

    /** A registered and logged-in guest that no other test uses. */
    public record FreshUser(String id, String email, String password, String token) {}

    private final AuthClient auth = new AuthClient();
    private final RoomClient rooms = new RoomClient();
    private final BookingClient bookings = new BookingClient();
    private final Tokens tokens;

    public TestData(Tokens tokens) {
        this.tokens = tokens;
    }

    /** OWN_ROOM: created by ADMIN for this test only (DOUBLE, capacity 2, 100.00). */
    public Room createRoom() {
        return createRoom(RoomRequest.newRoom());
    }

    public Room createRoom(RoomRequest request) {
        Response response = rooms.create(tokens.admin(), request);
        assertOk(response, 201, "room");
        return response.as(Room.class);
    }

    public FreshUser freshUser() {
        RegisterRequest user = RegisterRequest.newUser();
        Response registered = auth.register(user);
        assertOk(registered, 201, "user");
        Response login = auth.login(user.email(), user.password());
        assertOk(login, 200, "login-response");
        return new FreshUser(registered.jsonPath().getString("id"), user.email(), user.password(),
                login.jsonPath().getString("accessToken"));
    }

    /** POST /bookings without assertions (for tests that expect errors). */
    public Response book(String token, BookingRequest request) {
        return bookings.create(token, request);
    }

    /** POST /bookings that must succeed (201). */
    public Booking createBooking(String token, BookingRequest request) {
        Response response = book(token, request);
        assertOk(response, 201, "booking");
        return response.as(Booking.class);
    }

    /** Read a booking as ADMIN. */
    public Booking getBooking(String id) {
        return getBooking(id, tokens.admin());
    }

    public Booking getBooking(String id, String token) {
        Response response = bookings.get(token, id);
        assertOk(response, 200, "booking");
        return response.as(Booking.class);
    }

    public Room getRoom(String id) {
        Response response = rooms.get(id);
        assertOk(response, 200, "room");
        return response.as(Room.class);
    }

    /** Number of bookings the user sees (use with freshUser for state checks). */
    public int bookingsTotal(String token) {
        Response response = bookings.list(token);
        assertOk(response, 200, "booking-list");
        return response.jsonPath().getInt("total");
    }

    public List<Booking> allBookings(String token) {
        return allPages(page -> bookings.list(token, page, 100), Booking.class);
    }

    /** All rooms of GET /rooms for the given filters (token may be null). */
    public List<Room> allRooms(Map<String, ?> query, String token) {
        return allPages(page -> rooms.list(withPage(query, page), token), Room.class);
    }

    public List<AvailableRoom> allAvailable(Map<String, ?> query) {
        return allPages(page -> rooms.availability(withPage(query, page)), AvailableRoom.class);
    }

    public List<String> availableRoomIds(Map<String, ?> query) {
        return allAvailable(query).stream().map(AvailableRoom::id).toList();
    }

    /** Is there a room with this number (active or not)? Used to prove a room was NOT created. */
    public boolean roomNumberExists(String number) {
        return allRooms(Map.of("includeInactive", "true"), tokens.admin()).stream()
                .anyMatch(r -> r.number().equals(number));
    }

    private static Map<String, Object> withPage(Map<String, ?> query, int page) {
        Map<String, Object> result = new HashMap<>(query);
        result.put("page", page);
        result.put("limit", 100);
        return result;
    }

    /** Reads page 1, 2, … until a page has fewer than 100 items. */
    private static <T> List<T> allPages(Function<Integer, Response> fetchPage, Class<T> type) {
        List<T> items = new ArrayList<>();
        for (int page = 1; ; page++) {
            Response response = fetchPage.apply(page);
            assertStatus(response, 200);
            List<T> pageItems = response.jsonPath().getList("items", type);
            items.addAll(pageItems);
            if (pageItems.size() < 100) return items;
        }
    }
}
