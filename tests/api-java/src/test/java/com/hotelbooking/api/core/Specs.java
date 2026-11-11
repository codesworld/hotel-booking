package com.hotelbooking.api.core;

import com.hotelbooking.api.config.Config;
import io.qameta.allure.restassured.AllureRestAssured;
import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.builder.ResponseSpecBuilder;
import io.restassured.config.ObjectMapperConfig;
import io.restassured.config.RestAssuredConfig;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import io.restassured.specification.ResponseSpecification;

/**
 * Request and response specifications shared by all clients.
 * Every request is attached to the Allure report (request + response) by AllureRestAssured.
 */
public final class Specs {

    static {
        RestAssured.config = RestAssuredConfig.config()
                .objectMapperConfig(ObjectMapperConfig.objectMapperConfig()
                        .jackson2ObjectMapperFactory((type, charset) -> Json.MAPPER));
    }

    private Specs() {}

    /** booking-api: base URI from BASE_URL, JSON in and out. */
    public static RequestSpecification bookingApi() {
        return base(Config.baseUrl());
    }

    /** payment-service: base URI from PAYMENT_URL. */
    public static RequestSpecification paymentService() {
        return base(Config.paymentUrl());
    }

    /** Any successful JSON response with the given status. */
    public static ResponseSpecification json(int status) {
        return new ResponseSpecBuilder()
                .expectStatusCode(status)
                .expectContentType(ContentType.JSON)
                .build();
    }

    private static RequestSpecification base(String baseUri) {
        return new RequestSpecBuilder()
                .setBaseUri(baseUri)
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .addFilter(new AllureRestAssured())
                .build();
    }
}
