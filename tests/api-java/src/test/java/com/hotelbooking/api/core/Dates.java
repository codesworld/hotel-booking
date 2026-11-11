package com.hotelbooking.api.core;

import com.hotelbooking.api.config.Config;

import java.time.DayOfWeek;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;

/** Dates in the catalog's notation. All dates are UTC, "YYYY-MM-DD". */
public final class Dates {

    private Dates() {}

    /** D+n: today (UTC) plus n days. day(-1) is yesterday. */
    public static String day(int offset) {
        return LocalDate.now(ZoneOffset.UTC).plusDays(offset).toString();
    }

    public static String addDays(String isoDate, int days) {
        return LocalDate.parse(isoDate).plusDays(days).toString();
    }

    /** MON+n: the first Monday on or after D+60, plus n days (MON+4 is a Friday). */
    public static String monday(int plus) {
        LocalDate date = LocalDate.now(ZoneOffset.UTC).plusDays(60);
        while (date.getDayOfWeek() != DayOfWeek.MONDAY) date = date.plusDays(1);
        return date.plusDays(plus).toString();
    }

    /** CHECKIN(b): the check-in date at CHECKIN_HOUR_UTC. */
    public static Instant checkInMoment(String checkIn) {
        return LocalDate.parse(checkIn).atStartOfDay(ZoneOffset.UTC).toInstant()
                .plus(Duration.ofHours(Config.checkinHourUtc()));
    }

    /** "2026-12-01T12:00:00Z" style instant for a D+n date at the given time. */
    public static Instant at(String isoDate, String time) {
        return Instant.parse(isoDate + "T" + time + "Z");
    }
}
