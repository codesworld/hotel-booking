package com.hotelbooking.api.model;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

/** A room as returned by the API. */
public record Room(
        String id,
        String number,
        String type,
        int capacity,
        BigDecimal pricePerNight,
        @JsonProperty("isActive") boolean isActive) {}
