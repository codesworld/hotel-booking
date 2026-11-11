package com.hotelbooking.api.clients;

import com.hotelbooking.api.core.Specs;
import com.hotelbooking.api.model.Credentials;
import io.restassured.response.Response;

/** /auth endpoints of booking-api. */
public class AuthClient extends BaseClient {

    public AuthClient() {
        super(Specs.bookingApi());
    }

    public Response register(Object body) {
        return request(null).body(body).post("/auth/register");
    }

    public Response login(Object body) {
        return request(null).body(body).post("/auth/login");
    }

    public Response login(String email, String password) {
        return login(new Credentials(email, password));
    }

    public Response me(String token) {
        return request(token).get("/auth/me");
    }

    /** GET /auth/me with an Authorization header exactly as given (malformed header tests). */
    public Response meWithAuthorizationHeader(String headerValue) {
        return request(null).header("Authorization", headerValue).get("/auth/me");
    }
}
