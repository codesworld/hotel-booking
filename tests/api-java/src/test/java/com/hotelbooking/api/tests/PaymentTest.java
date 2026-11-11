package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.Payment;
import com.hotelbooking.api.model.Room;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Payment integration")
class PaymentTest extends BaseTest {

    private Response bookWithCard(String cardToken) {
        Room room = data.createRoom();
        return data.book(tokens.g1(), BookingRequest.forRoom(room.id()).withCardToken(cardToken));
    }

    /** The booking that a failed payment left behind (its id is in error.details.bookingId). */
    private Booking failedBooking(Response response) {
        String bookingId = response.jsonPath().getString("error.details.bookingId");
        assertThat(bookingId).as("error.details.bookingId").isNotBlank();
        return data.getBooking(bookingId, tokens.g1());
    }

    @Test
    @Tag("smoke")
    @DisplayName("PAY-001 Approved payment confirms the booking")
    void approvedPayment() {
        Response response = bookWithCard("tok_success");
        assertOk(response, 201, "booking");

        Booking booking = data.getBooking(response.jsonPath().getString("id"), tokens.g1());
        assertThat(booking.status()).isEqualTo("CONFIRMED");
        assertThat(booking.paymentId()).isNotNull();

        Response paymentResponse = payments.get(booking.paymentId());
        assertOk(paymentResponse, 200, "payment");
        Payment payment = paymentResponse.as(Payment.class);
        assertThat(payment.status()).isEqualTo("APPROVED");
        assertThat(payment.amount()).isEqualByComparingTo(booking.totalPrice());
        assertThat(payment.bookingId()).isEqualTo(booking.id());
    }

    @Test
    @Tag("smoke")
    @DisplayName("PAY-002 Declined payment")
    void declinedPayment() {
        Response response = bookWithCard("tok_decline");
        assertError(response, 402, "PAYMENT_DECLINED");

        Booking booking = failedBooking(response);
        assertThat(booking.status()).isEqualTo("PAYMENT_FAILED");
        assertThat(booking.paymentId()).isNotNull();

        Response payment = payments.get(booking.paymentId());
        assertOk(payment, 200, "payment");
        assertThat(payment.jsonPath().getString("status")).isEqualTo("DECLINED");
    }

    @Test
    @Tag("regression")
    @DisplayName("PAY-003 Payment timeout")
    void paymentTimeout() {
        Response response = bookWithCard("tok_slow");
        assertError(response, 504, "PAYMENT_TIMEOUT");
        // booking-api gives up after 3 s; it must not wait for the full 5 s of tok_slow
        assertThat(response.time()).isBetween(2900L, 4499L);

        Booking booking = failedBooking(response);
        assertThat(booking.status()).isEqualTo("PAYMENT_FAILED");
        assertThat(booking.paymentId()).isNull();
    }

    @Test
    @Tag("regression")
    @DisplayName("PAY-004 Payment service error")
    void paymentServiceError() {
        Response response = bookWithCard("tok_error");
        assertError(response, 502, "PAYMENT_SERVICE_ERROR");

        Booking booking = failedBooking(response);
        assertThat(booking.status()).isEqualTo("PAYMENT_FAILED");
        assertThat(booking.paymentId()).isNull();
    }

    @Test
    @Tag("regression")
    @DisplayName("PAY-005 Unknown card token")
    void unknownCardToken() {
        Room room = data.createRoom();
        var user = data.freshUser();
        assertError(data.book(user.token(), BookingRequest.forRoom(room.id()).withCardToken("tok_unknown")),
                400, "VALIDATION_ERROR", "cardToken");

        // State: nothing saved, and the room is still bookable for the same dates
        assertThat(data.bookingsTotal(user.token())).isZero();
        data.createBooking(user.token(), BookingRequest.forRoom(room.id()));
    }

    @Test
    @Tag("regression")
    @DisplayName("PAY-006 Empty card token")
    void emptyCardToken() {
        Room room = data.createRoom();
        var user = data.freshUser();
        assertError(data.book(user.token(), BookingRequest.forRoom(room.id()).withCardToken("")),
                400, "VALIDATION_ERROR", "cardToken");
        assertThat(data.bookingsTotal(user.token())).isZero();
    }

    @Test
    @Tag("manual")
    @Disabled("Manual case: needs `docker compose stop payment-service`")
    @DisplayName("PAY-007 payment-service down")
    void paymentServiceDown() {
    }
}
