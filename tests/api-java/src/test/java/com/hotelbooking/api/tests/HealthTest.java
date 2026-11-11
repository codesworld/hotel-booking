package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.ApiAssertions.assertStatus;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Health")
class HealthTest extends BaseTest {

    @Test
    @Tag("smoke")
    @DisplayName("HLTH-001 booking-api health reports database up")
    void bookingApiHealth() {
        Response response = system.health();
        assertOk(response, 200, "health");
        assertThat(response.jsonPath().getMap("")).isEqualTo(
                Map.of("status", "ok", "service", "booking-api", "database", "up"));
    }

    @Test
    @Tag("smoke")
    @DisplayName("HLTH-002 payment-service health")
    void paymentServiceHealth() {
        Response response = payments.health();
        assertOk(response, 200, "health");
        assertThat(response.jsonPath().getMap("")).isEqualTo(Map.of("status", "ok", "service", "payment-service"));
    }

    @Test
    @Tag("regression")
    @DisplayName("HLTH-003 OpenAPI spec lists every endpoint")
    void openApiListsEveryEndpoint() {
        Response response = system.openApiSpec();
        assertStatus(response, 200);
        assertThat(response.jsonPath().getMap("paths").keySet()).contains(
                "/auth/register", "/auth/login", "/auth/me",
                "/rooms", "/rooms/{id}", "/rooms/availability",
                "/bookings", "/bookings/{id}", "/bookings/{id}/cancel",
                "/health");
    }
}
