package com.hotelbooking.api.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/** An item of GET /rooms/availability: a room plus the price of the requested stay. */
public record AvailableRoom(
        String id,
        String number,
        String type,
        int capacity,
        BigDecimal pricePerNight,
        @JsonProperty("isActive") boolean isActive,
        int nights,
        BigDecimal totalPrice) {}
