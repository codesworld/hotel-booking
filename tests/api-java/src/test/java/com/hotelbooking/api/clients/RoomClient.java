package com.hotelbooking.api.clients;

import com.hotelbooking.api.core.Specs;
import io.restassured.response.Response;

import java.time.Instant;
import java.util.Map;

/** /rooms endpoints of booking-api. */
public class RoomClient extends BaseClient {

    public RoomClient() {
        super(Specs.bookingApi());
    }

    /** GET /rooms with query parameters (page, limit, type, includeInactive). token may be null. */
    public Response list(Map<String, ?> query, String token) {
        return request(token).queryParams(query).get("/rooms");
    }

    public Response get(String id) {
        return request(null).get("/rooms/{id}", id);
    }

    /** GET /rooms/availability with query parameters (checkIn, checkOut, guests, type, page, limit). */
    public Response availability(Map<String, ?> query) {
        return request(null).queryParams(query).get("/rooms/availability");
    }

    /** GET /rooms/{id}/quote with query parameters (checkIn, checkOut). Public, no token. */
    public Response quote(String id, Map<String, ?> query) {
        return request(null).queryParams(query).get("/rooms/{id}/quote", id);
    }

    public Response quote(String id, String checkIn, String checkOut) {
        return quote(id, Map.of("checkIn", checkIn, "checkOut", checkOut));
    }

    public Response create(String token, Object body) {
        return request(token).body(body).post("/rooms");
    }

    public Response replace(String token, String id, Object body) {
        return request(token).body(body).put("/rooms/{id}", id);
    }

    public Response patch(String token, String id, Object body) {
        return request(token).body(body).patch("/rooms/{id}", id);
    }

    public Response patch(String token, String id, Object body, Instant now) {
        return request(token, now).body(body).patch("/rooms/{id}", id);
    }
}
