package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("payment-service")
@Feature("Payments API")
class PaymentServiceTest extends BaseTest {

    private static Map<String, Object> paymentRequest(String cardToken) {
        Map<String, Object> body = new HashMap<>();
        body.put("bookingId", UUID.randomUUID().toString());
        body.put("amount", new BigDecimal("123.45"));
        body.put("cardToken", cardToken);
        return body;
    }

    @Test
    @Tag("regression")
    @DisplayName("PSVC-001 Approve a payment")
    void approvePayment() {
        Response response = payments.create(paymentRequest("tok_success"));
        assertOk(response, 201, "payment");
        assertThat(response.header("Location")).isEqualTo("/payments/" + response.jsonPath().getString("id"));
        assertThat(response.jsonPath().getString("status")).isEqualTo("APPROVED");
        assertThat(response.jsonPath().getDouble("amount")).isEqualTo(123.45);
    }

    @Test
    @Tag("regression")
    @DisplayName("PSVC-002 Decline a payment")
    void declinePayment() {
        Response response = payments.create(paymentRequest("tok_decline"));
        assertError(response, 402, "PAYMENT_DECLINED");
        assertThat(response.jsonPath().getString("error.details.payment.status")).isEqualTo("DECLINED");

        Response read = payments.get(response.jsonPath().getString("error.details.payment.id"));
        assertOk(read, 200, "payment");
        assertThat(read.jsonPath().getString("status")).isEqualTo("DECLINED");
    }

    @Test
    @Tag("regression")
    @DisplayName("PSVC-003 Simulated provider failure")
    void providerFailure() {
        Response response = payments.create(paymentRequest("tok_error"));
        assertError(response, 500, "INTERNAL_ERROR");
        assertThat(response.asString()).doesNotContain("stack", "node_modules");
    }

    @Test
    @Tag("regression")
    @DisplayName("PSVC-004 Unknown card token")
    void unknownCardToken() {
        assertError(payments.create(paymentRequest("tok_foo")), 400, "INVALID_CARD_TOKEN", "cardToken");
    }

    @Test
    @Tag("regression")
    @DisplayName("PSVC-005 Slow token answers after 5 s")
    void slowToken() {
        Response response = payments.create(paymentRequest("tok_slow"));
        assertOk(response, 201, "payment");
        assertThat(response.time()).isGreaterThanOrEqualTo(4900L);
    }

    static Stream<Arguments> invalidRequests() {
        return Stream.of(
                Arguments.of("missing amount", "amount", null, "amount"),
                Arguments.of("negative amount", "amount", -1, "amount"),
                Arguments.of("extra field", "foo", "bar", "foo"));
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @Tag("regression")
    @DisplayName("PSVC-006 Request validation")
    @MethodSource("invalidRequests")
    void requestValidation(String name, String key, Object value, String field) {
        Map<String, Object> body = paymentRequest("tok_success");
        if (value == null) body.remove(key);
        else body.put(key, value);
        assertError(payments.create(body), 400, "VALIDATION_ERROR", field);
    }

    @Test
    @Tag("regression")
    @DisplayName("PSVC-007 Get unknown payment")
    void unknownPayment() {
        assertError(payments.get(UNKNOWN_ID), 404, "NOT_FOUND");
    }
}
