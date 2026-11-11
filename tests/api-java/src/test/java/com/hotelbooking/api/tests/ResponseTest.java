package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.config.Config;
import com.hotelbooking.api.core.Json;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.RegisterRequest;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.RoomRequest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.day;
import static com.hotelbooking.api.core.SchemaValidator.assertMatchesSchema;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Response validation")
class ResponseTest extends BaseTest {

    @Test
    @Tag("regression")
    @DisplayName("RESP-001 JSON Content-Type on success and error")
    void jsonContentType() {
        for (Response response : List.of(
                rooms.list(Map.of(), null),
                rooms.get(UNKNOWN_ID),
                auth.login(Map.of()))) {
            assertThat(response.contentType()).startsWith("application/json");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-002 Error format is consistent across status codes")
    void errorFormatConsistent() {
        Room room = data.createRoom();
        Map<String, Object> missingRoomId = Json.toMap(BookingRequest.forRoom(room.id()));
        missingRoomId.remove("roomId");

        Map<Integer, Response> errors = new LinkedHashMap<>();
        errors.put(400, bookings.create(tokens.g1(), missingRoomId));
        errors.put(401, auth.me(null));
        errors.put(403, bookings.get(tokens.g2(), seed.booking(1).id()));
        errors.put(404, rooms.get(UNKNOWN_ID));
        errors.put(409, rooms.patch(tokens.admin(), seed.room("301").id(), Map.of("isActive", false)));
        errors.put(415, bookings.request(tokens.g1()).contentType("text/plain").body("{}").post("/bookings"));
        errors.put(422, bookings.cancel(tokens.g2(), seed.booking(6).id()));

        errors.forEach((status, response) -> {
            assertThat(response.statusCode()).as("expected %d: %s", status, response.asString()).isEqualTo(status);
            assertMatchesSchema(response, "error");
            assertThat(response.jsonPath().getString("error.code")).matches("^[A-Z][A-Z_]*$");
            assertThat(response.jsonPath().getString("error.message")).isNotBlank();
        });
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-003 Unknown route returns JSON 404")
    void unknownRouteJson404() {
        for (Response response : List.of(
                system.request(null).get("/does-not-exist"),
                rooms.request(null).delete("/rooms/" + seed.room("101").id()))) {
            assertError(response, 404, "NOT_FOUND");
            assertThat(response.asString()).doesNotContainIgnoringCase("<html");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-004 No sensitive data in responses")
    void noSensitiveData() {
        RegisterRequest user = RegisterRequest.newUser();
        for (Response response : List.of(
                auth.register(user),
                auth.login(user.email(), user.password()),
                auth.me(tokens.g1()),
                bookings.list(tokens.admin(), 1, 100))) {
            assertThat(response.statusCode()).isLessThan(300);
            assertThat(response.asString()).doesNotContainIgnoringCase("password").doesNotContainPattern("\\$2[aby]\\$");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-005 No framework or version headers")
    void noFrameworkHeaders() {
        for (Response response : List.of(system.health(), system.request(null).get("/does-not-exist"))) {
            assertThat(response.header("X-Powered-By")).isNull();
            String server = response.header("Server");
            if (server != null) assertThat(server).doesNotContainPattern("(?i)express|node|\\d+\\.\\d+");
        }
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-006 No stack trace in errors")
    void noStackTrace() {
        Response response = bookings.request(tokens.g1()).body("{\"roomId\": ").post("/bookings");
        assertError(response, 400, "INVALID_JSON");
        assertThat(response.asString()).doesNotContain("stack", "node_modules").doesNotContainPattern("\\bat \\S+\\.(js|ts):\\d+");
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-007 Response time under 500 ms")
    void responseTimeUnder500ms() {
        Room room = data.createRoom();
        Map<String, Response> timings = new LinkedHashMap<>();
        timings.put("GET /rooms", rooms.list(Map.of(), null));
        timings.put("GET /rooms/availability", rooms.availability(Map.of("checkIn", day(100), "checkOut", day(103))));
        timings.put("POST /auth/login", auth.login(Config.guest1()));
        timings.put("POST /bookings", bookings.create(tokens.g1(), BookingRequest.forRoom(room.id())));
        timings.put("GET /bookings", bookings.list(tokens.g1()));

        timings.forEach((name, response) -> {
            assertThat(response.statusCode()).as("%s: %s", name, response.asString()).isLessThan(300);
            assertThat(response.time()).as("%s took %d ms", name, response.time()).isLessThan(500L);
        });
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-008 Payload too large")
    void payloadTooLarge() {
        var user = data.freshUser();
        Response response = bookings.create(user.token(), Map.of("cardToken", "x".repeat(200_000)));
        assertError(response, 413, "PAYLOAD_TOO_LARGE");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("RESP-009 Location header on every 201")
    void locationHeaderOn201() {
        Response created = rooms.create(tokens.admin(), RoomRequest.newRoom());
        assertOk(created, 201, "room");
        String roomId = created.jsonPath().getString("id");
        assertThat(created.header("Location")).isEqualTo("/rooms/" + roomId);
        assertOk(rooms.request(null).get(created.header("Location")), 200, "room");

        Response booked = bookings.create(tokens.g1(), BookingRequest.forRoom(roomId));
        assertOk(booked, 201, "booking");
        assertThat(booked.header("Location")).isEqualTo("/bookings/" + booked.jsonPath().getString("id"));
        assertOk(bookings.request(tokens.g1()).get(booked.header("Location")), 200, "booking");
    }
}
