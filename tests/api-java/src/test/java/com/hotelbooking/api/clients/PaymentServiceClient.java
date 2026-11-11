package com.hotelbooking.api.clients;

import com.hotelbooking.api.core.Specs;
import io.restassured.response.Response;

/** payment-service (PAYMENT_URL). */
public class PaymentServiceClient extends BaseClient {

    public PaymentServiceClient() {
        super(Specs.paymentService());
    }

    public Response create(Object body) {
        return request(null).body(body).post("/payments");
    }

    public Response get(String id) {
        return request(null).get("/payments/{id}", id);
    }

    public Response health() {
        return request(null).get("/health");
    }
}
