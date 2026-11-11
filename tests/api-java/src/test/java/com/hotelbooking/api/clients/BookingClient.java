package com.hotelbooking.api.clients;

import com.hotelbooking.api.core.Specs;
import io.restassured.response.Response;

import java.time.Instant;

/** /bookings endpoints of booking-api. */
public class BookingClient extends BaseClient {

    public BookingClient() {
        super(Specs.bookingApi());
    }

    public Response create(String token, Object body) {
        return request(token).body(body).post("/bookings");
    }

    public Response create(String token, Object body, Instant now) {
        return request(token, now).body(body).post("/bookings");
    }

    public Response list(String token, int page, int limit) {
        return request(token).queryParam("page", page).queryParam("limit", limit).get("/bookings");
    }

    public Response list(String token) {
        return request(token).get("/bookings");
    }

    public Response get(String token, String id) {
        return request(token).get("/bookings/{id}", id);
    }

    public Response cancel(String token, String id) {
        return request(token).post("/bookings/{id}/cancel", id);
    }

    public Response cancel(String token, String id, Instant now) {
        return request(token, now).post("/bookings/{id}/cancel", id);
    }
}
