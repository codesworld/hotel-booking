package com.hotelbooking.api.core;

import io.restassured.response.Response;

import static com.hotelbooking.api.core.SchemaValidator.assertMatchesSchema;
import static org.assertj.core.api.Assertions.assertThat;

/** Reusable assertions: status, schema and the standard error format. */
public final class ApiAssertions {

    private ApiAssertions() {}

    /** Status check whose failure message shows the body. */
    public static void assertStatus(Response response, int status) {
        assertThat(response.statusCode()).as("status (body: %s)", response.asString()).isEqualTo(status);
    }

    /** Status + JSON schema. */
    public static void assertOk(Response response, int status, String schema) {
        assertStatus(response, status);
        assertMatchesSchema(response, schema);
    }

    /** Status + error schema + error.code. */
    public static void assertError(Response response, int status, String code) {
        assertStatus(response, status);
        assertMatchesSchema(response, "error");
        assertThat(response.jsonPath().getString("error.code")).as("error.code").isEqualTo(code);
    }

    /** Status + error schema + error.code + error.field. */
    public static void assertError(Response response, int status, String code, String field) {
        assertError(response, status, code);
        assertThat(response.jsonPath().getString("error.field")).as("error.field").isEqualTo(field);
    }
}
