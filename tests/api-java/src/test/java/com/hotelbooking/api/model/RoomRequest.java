package com.hotelbooking.api.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;
import java.util.UUID;

/** Body of POST/PUT /rooms. NEW_ROOM in the catalog: DOUBLE, capacity 2, 100.00. isActive is left out when null. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record RoomRequest(
        String number,
        String type,
        Integer capacity,
        BigDecimal pricePerNight,
        @JsonProperty("isActive") Boolean isActive) {

    public static RoomRequest newRoom() {
        return new RoomRequest(uniqueNumber(), "DOUBLE", 2, new BigDecimal("100"), null);
    }

    /** 1-10 characters of [A-Za-z0-9-], unique per call. */
    public static String uniqueNumber() {
        return "T" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
    }

    public RoomRequest withNumber(String value) { return new RoomRequest(value, type, capacity, pricePerNight, isActive); }
    public RoomRequest withType(String value) { return new RoomRequest(number, value, capacity, pricePerNight, isActive); }
    public RoomRequest withCapacity(Integer value) { return new RoomRequest(number, type, value, pricePerNight, isActive); }
    public RoomRequest withPrice(String value) { return new RoomRequest(number, type, capacity, new BigDecimal(value), isActive); }
    public RoomRequest withActive(Boolean value) { return new RoomRequest(number, type, capacity, pricePerNight, value); }
}
