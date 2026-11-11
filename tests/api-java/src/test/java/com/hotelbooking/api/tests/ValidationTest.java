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
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.day;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Validation")
class ValidationTest extends BaseTest {

    private Map<String, Object> bookingMap(Room room) {
        return Json.toMap(BookingRequest.forRoom(room.id()));
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("VAL-001 POST /bookings: each required field missing")
    @ValueSource(strings = {"roomId", "checkIn", "checkOut", "guests", "cardToken"})
    void bookingFieldMissing(String field) {
        Room room = data.createRoom();
        var user = data.freshUser();
        Map<String, Object> body = bookingMap(room);
        body.remove(field);

        Response response = bookings.create(user.token(), body);
        assertError(response, 400, "VALIDATION_ERROR", field);
        assertThat(response.jsonPath().getString("error.message")).isEqualTo(field + " is required");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("VAL-002 POST /auth/register: each required field missing")
    @ValueSource(strings = {"email", "password", "fullName"})
    void registerFieldMissing(String field) {
        Map<String, Object> body = Json.toMap(RegisterRequest.newUser());
        body.remove(field);
        assertError(auth.register(body), 400, "VALIDATION_ERROR", field);
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("VAL-003 POST /auth/login: each required field missing")
    @ValueSource(strings = {"email", "password"})
    void loginFieldMissing(String field) {
        Map<String, Object> body = Json.toMap(Config.guest1());
        body.remove(field);
        assertError(auth.login(body), 400, "VALIDATION_ERROR", field);
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("VAL-004 POST /rooms: each required field missing")
    @ValueSource(strings = {"number", "type", "capacity", "pricePerNight"})
    void roomFieldMissing(String field) {
        RoomRequest room = RoomRequest.newRoom();
        Map<String, Object> body = Json.toMap(room);
        body.remove(field);
        assertError(rooms.create(tokens.admin(), body), 400, "VALIDATION_ERROR", field);
        assertThat(data.roomNumberExists(room.number())).isFalse();
    }

    static Stream<Arguments> bookingWrongTypes() {
        return Stream.of(
                Arguments.of("guests", "1"), Arguments.of("guests", 1.5), Arguments.of("guests", true),
                Arguments.of("roomId", 123), Arguments.of("checkIn", 20261201), Arguments.of("cardToken", null),
                Arguments.of("checkOut", List.of()));
    }

    @ParameterizedTest(name = "{displayName} [{0}={1}]")
    @Tag("regression")
    @DisplayName("VAL-005 POST /bookings: wrong types")
    @MethodSource("bookingWrongTypes")
    void bookingWrongTypes(String field, Object value) {
        Room room = data.createRoom();
        var user = data.freshUser();
        Map<String, Object> body = bookingMap(room);
        body.put(field, value);

        Response response = bookings.create(user.token(), body);
        assertError(response, 400, "VALIDATION_ERROR", field);
        if ("1".equals(value)) {
            assertThat(response.jsonPath().getString("error.message")).isEqualTo("guests must be of type number");
        }
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    static Stream<Arguments> roomWrongTypes() {
        return Stream.of(
                Arguments.of("capacity", "2"), Arguments.of("capacity", 2.5), Arguments.of("pricePerNight", "100"),
                Arguments.of("type", 1), Arguments.of("number", 101), Arguments.of("isActive", "false"));
    }

    @ParameterizedTest(name = "{displayName} [{0}={1}]")
    @Tag("regression")
    @DisplayName("VAL-006 POST /rooms: wrong types")
    @MethodSource("roomWrongTypes")
    void roomWrongTypes(String field, Object value) {
        RoomRequest room = RoomRequest.newRoom();
        Map<String, Object> body = Json.toMap(room);
        body.put(field, value);
        assertError(rooms.create(tokens.admin(), body), 400, "VALIDATION_ERROR", field);
        if (!field.equals("number")) assertThat(data.roomNumberExists(room.number())).isFalse();
    }

    @ParameterizedTest(name = "{displayName} [\"{0}\"]")
    @Tag("regression")
    @DisplayName("VAL-007 Invalid checkIn date formats")
    @ValueSource(strings = {"2026/12/01", "01-12-2026", "2026-12-1", "2026-13-01", "2027-02-30", "2026-12-01T00:00:00Z", "", "tomorrow"})
    void invalidCheckInFormat(String checkIn) {
        Room room = data.createRoom();
        var body = BookingRequest.forRoom(room.id()).withDates(checkIn, day(32));
        assertError(bookings.create(tokens.g1(), body), 400, "VALIDATION_ERROR", "checkIn");
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-008 Invalid checkOut date format")
    void invalidCheckOutFormat() {
        Room room = data.createRoom();
        var body = BookingRequest.forRoom(room.id()).withDates(day(30), "2026-12-32");
        assertError(bookings.create(tokens.g1(), body), 400, "VALIDATION_ERROR", "checkOut");
    }

    static Stream<Arguments> unknownBookingFields() {
        return Stream.of(
                Arguments.of("status", "CONFIRMED"), Arguments.of("totalPrice", 1),
                Arguments.of("userId", "SEED_G2_ID"), Arguments.of("paymentId", "x"));
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @Tag("regression")
    @DisplayName("VAL-009 Unknown fields are rejected (mass assignment)")
    @MethodSource("unknownBookingFields")
    void unknownBookingField(String field, Object value) {
        Room room = data.createRoom();
        var user = data.freshUser();
        Map<String, Object> body = bookingMap(room);
        body.put(field, "SEED_G2_ID".equals(value) ? seed.g2().id() : value);

        Response response = bookings.create(user.token(), body);
        assertError(response, 400, "VALIDATION_ERROR", field);
        assertThat(response.jsonPath().getString("error.message")).isEqualTo("Unknown field: " + field);
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-010 Unknown field on room create")
    void unknownRoomField() {
        RoomRequest room = RoomRequest.newRoom();
        Map<String, Object> body = Json.toMap(room);
        body.put("id", UNKNOWN_ID);
        assertError(rooms.create(tokens.admin(), body), 400, "VALIDATION_ERROR", "id");
        assertThat(data.roomNumberExists(room.number())).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-011 Malformed JSON body")
    void malformedJson() {
        var user = data.freshUser();
        Response response = bookings.request(user.token()).body("{\"roomId\": ").post("/bookings");
        assertError(response, 400, "INVALID_JSON");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-012 Malformed JSON on login")
    void malformedJsonOnLogin() {
        assertError(auth.request(null).body("{email:").post("/auth/login"), 400, "INVALID_JSON");
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-013 Wrong Content-Type")
    void wrongContentType() throws Exception {
        Room room = data.createRoom();
        var user = data.freshUser();
        String json = Json.MAPPER.writeValueAsString(BookingRequest.forRoom(room.id()));
        Response response = bookings.request(user.token()).contentType("text/plain").body(json).post("/bookings");
        assertError(response, 415, "UNSUPPORTED_MEDIA_TYPE");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-014 Form-encoded body is rejected")
    void formEncodedBody() {
        RegisterRequest user = RegisterRequest.newUser();
        Response response = auth.request(null).contentType(ContentType.URLENC)
                .formParam("email", user.email())
                .formParam("password", user.password())
                .formParam("fullName", user.fullName())
                .post("/auth/register");
        assertError(response, 415, "UNSUPPORTED_MEDIA_TYPE");
        assertError(auth.login(user.email(), user.password()), 401, "INVALID_CREDENTIALS");
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-015 Body is JSON but not an object")
    void bodyNotAnObject() {
        Response array = bookings.request(tokens.g1()).body("[]").post("/bookings");
        assertError(array, 400, "VALIDATION_ERROR");
        assertThat(array.jsonPath().getString("error.message")).isEqualTo("Request body must be a JSON object");

        Response text = bookings.request(tokens.g1()).body("\"text\"").post("/bookings");
        assertError(text, 400, "INVALID_JSON");
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-016 Empty body")
    void emptyBody() {
        Response response = bookings.request(tokens.g1()).post("/bookings");
        assertError(response, 400, "VALIDATION_ERROR");
        assertThat(response.jsonPath().getString("error.field"))
                .isIn("roomId", "checkIn", "checkOut", "guests", "cardToken");
    }

    @ParameterizedTest(name = "{displayName} [limit={0} → {1}]")
    @Tag("regression")
    @DisplayName("VAL-017 Pagination limit boundaries")
    @CsvSource({"0, 400", "1, 200", "100, 200", "101, 400"})
    void limitBoundaries(int limit, int status) {
        Response response = rooms.list(Map.of("limit", limit), null);
        if (status == 400) {
            assertError(response, 400, "VALIDATION_ERROR", "limit");
            return;
        }
        assertOk(response, 200, "room-list");
        assertThat(response.jsonPath().getInt("limit")).isEqualTo(limit);
        assertThat(response.jsonPath().getList("items")).hasSizeLessThanOrEqualTo(limit);
    }

    @ParameterizedTest(name = "{displayName} [page={0}]")
    @Tag("regression")
    @DisplayName("VAL-018 Invalid page values")
    @ValueSource(strings = {"0", "-1", "abc", "1.5"})
    void invalidPage(String page) {
        assertError(rooms.list(Map.of("page", page), null), 400, "VALIDATION_ERROR", "page");
    }

    @ParameterizedTest(name = "{displayName} [capacity={0} → {1}]")
    @Tag("regression")
    @DisplayName("VAL-019 Room capacity boundaries")
    @CsvSource({"0, 400", "1, 201", "6, 201", "7, 400"})
    void capacityBoundaries(int capacity, int status) {
        Response response = rooms.create(tokens.admin(), RoomRequest.newRoom().withCapacity(capacity));
        if (status == 201) assertOk(response, 201, "room");
        else assertError(response, 400, "VALIDATION_ERROR", "capacity");
    }

    @ParameterizedTest(name = "{displayName} [pricePerNight={0} → {1}]")
    @Tag("regression")
    @DisplayName("VAL-020 Room price boundaries")
    @CsvSource({"0, 400", "-1, 400", "0.01, 201", "10.999, 400"})
    void priceBoundaries(String price, int status) {
        Response response = rooms.create(tokens.admin(), RoomRequest.newRoom().withPrice(price));
        if (status == 201) assertOk(response, 201, "room");
        else assertError(response, 400, "VALIDATION_ERROR", "pricePerNight");
    }

    static Stream<Arguments> roomNumbers() {
        return Stream.of(
                Arguments.of("empty", "", 400),
                Arguments.of("11 characters", "ABCDEFGHIJK", 400),
                Arguments.of("contains space", "1 01", 400),
                Arguments.of("letters, digits and dash", "A1-" + RoomRequest.uniqueNumber().substring(1, 6), 201));
    }

    @ParameterizedTest(name = "{displayName} [{0} → {2}]")
    @Tag("regression")
    @DisplayName("VAL-021 Room number format")
    @MethodSource("roomNumbers")
    void roomNumberFormat(String name, String number, int status) {
        Response response = rooms.create(tokens.admin(), RoomRequest.newRoom().withNumber(number));
        if (status == 201) assertOk(response, 201, "room");
        else assertError(response, 400, "VALIDATION_ERROR", "number");
    }

    @Test
    @Tag("regression")
    @DisplayName("VAL-022 Room type must be a known value")
    void unknownRoomType() {
        Response response = rooms.create(tokens.admin(), RoomRequest.newRoom().withType("TRIPLE"));
        assertError(response, 400, "VALIDATION_ERROR", "type");
        assertThat(response.jsonPath().getString("error.message")).contains("SINGLE, DOUBLE, SUITE");
    }

    static Stream<Arguments> availabilityQueries() {
        Map<String, Object> valid = Map.of("checkIn", day(100), "checkOut", day(101));
        return Stream.of(
                Arguments.of("no checkIn", Map.of("checkOut", day(101)), "checkIn"),
                Arguments.of("no checkOut", Map.of("checkIn", day(100)), "checkOut"),
                Arguments.of("guests=0", with(valid, "guests", 0), "guests"),
                Arguments.of("guests=7", with(valid, "guests", 7), "guests"),
                Arguments.of("type=TRIPLE", with(valid, "type", "TRIPLE"), "type"),
                Arguments.of("checkIn=2026/12/01", with(valid, "checkIn", "2026/12/01"), "checkIn"));
    }

    private static Map<String, Object> with(Map<String, Object> base, String key, Object value) {
        Map<String, Object> copy = new HashMap<>(base);
        copy.put(key, value);
        return copy;
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @Tag("regression")
    @DisplayName("VAL-023 Availability query validation")
    @MethodSource("availabilityQueries")
    void availabilityQueryValidation(String name, Map<String, Object> query, String field) {
        assertError(rooms.availability(query), 400, "VALIDATION_ERROR", field);
    }
}
