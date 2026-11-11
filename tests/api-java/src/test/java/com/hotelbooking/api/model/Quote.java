package com.hotelbooking.api.model;

import java.math.BigDecimal;
import java.util.List;

/** Response of GET /rooms/{id}/quote: price of a stay, night by night. */
public record Quote(
        String roomId,
        String checkIn,
        String checkOut,
        BigDecimal pricePerNight,
        List<Night> nights,
        BigDecimal totalPrice) {

    public record Night(String date, boolean isWeekend, BigDecimal price) {}
}
