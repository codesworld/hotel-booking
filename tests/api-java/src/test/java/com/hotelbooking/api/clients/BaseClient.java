package com.hotelbooking.api.clients;

import io.restassured.specification.RequestSpecification;

import java.time.Instant;

import static io.restassured.RestAssured.given;

/**
 * Common part of all clients. Clients return the raw Rest Assured Response:
 * the test decides what to assert (status, schema, body, headers, time).
 */
public abstract class BaseClient {

    private final RequestSpecification spec;

    protected BaseClient(RequestSpecification spec) {
        this.spec = spec;
    }

    /**
     * A request with the base spec and, if token is not null, "Authorization: Bearer token".
     * Public so tests can build unusual requests (raw bodies, odd headers) with the same base spec.
     */
    public RequestSpecification request(String token) {
        RequestSpecification request = given().spec(spec);
        if (token != null) request.header("Authorization", "Bearer " + token);
        return request;
    }

    /** Same, plus "X-Test-Now: now" so booking-api treats `now` as the current time (APP_ENV=test). */
    public RequestSpecification request(String token, Instant now) {
        return request(token).header("X-Test-Now", now.toString());
    }
}
