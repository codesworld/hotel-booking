package com.hotelbooking.api.model;

import java.math.BigDecimal;

/** A payment of payment-service. */
public record Payment(String id, String bookingId, BigDecimal amount, String status, String createdAt) {}
