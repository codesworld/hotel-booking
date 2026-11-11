package com.hotelbooking.api.clients;

import com.hotelbooking.api.core.Specs;
import io.restassured.response.Response;

/** booking-api endpoints that are not business resources: health, docs, test hooks. */
public class SystemClient extends BaseClient {

    public SystemClient() {
        super(Specs.bookingApi());
    }

    public Response health() {
        return request(null).get("/health");
    }

    public Response openApiSpec() {
        return request(null).get("/docs/openapi.json");
    }

    /** POST /test/seed (APP_ENV=test only): wipes the database and loads the known dataset. */
    public Response seed() {
        return request(null).post("/test/seed");
    }
}
