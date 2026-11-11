package com.hotelbooking.api.model;

import java.math.BigDecimal;

/** A booking as returned by the API. */
public record Booking(
        String id,
        String roomId,
        String userId,
        String checkIn,
        String checkOut,
        int guests,
        BigDecimal totalPrice,
        String status,
        String paymentId,
        String createdAt,
        String cancelledAt) {}
