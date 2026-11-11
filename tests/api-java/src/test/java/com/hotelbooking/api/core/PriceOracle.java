package com.hotelbooking.api.core;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;

/**
 * Independent test oracle for rule 10 (NOT a copy of the API code):
 * Friday and Saturday nights cost +20%, total rounded half-up to 2 decimals.
 */
public final class PriceOracle {

    private static final BigDecimal WEEKEND = new BigDecimal("1.2");

    private PriceOracle() {}

    public static BigDecimal expectedPrice(BigDecimal pricePerNight, String checkIn, String checkOut) {
        BigDecimal total = BigDecimal.ZERO;
        for (LocalDate night = LocalDate.parse(checkIn); night.isBefore(LocalDate.parse(checkOut)); night = night.plusDays(1)) {
            boolean weekend = night.getDayOfWeek() == DayOfWeek.FRIDAY || night.getDayOfWeek() == DayOfWeek.SATURDAY;
            total = total.add(weekend ? pricePerNight.multiply(WEEKEND) : pricePerNight);
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }
}
