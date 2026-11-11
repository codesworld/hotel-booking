package com.hotelbooking.api.model;

import static com.hotelbooking.api.core.Dates.day;

/** Body of POST /bookings. BOOKING in the catalog: D+30 → D+32, 1 guest, tok_success. */
public record BookingRequest(String roomId, String checkIn, String checkOut, Integer guests, String cardToken) {

    public static BookingRequest forRoom(String roomId) {
        return new BookingRequest(roomId, day(30), day(32), 1, "tok_success");
    }

    public BookingRequest withDates(String in, String out) { return new BookingRequest(roomId, in, out, guests, cardToken); }
    public BookingRequest withGuests(Integer value) { return new BookingRequest(roomId, checkIn, checkOut, value, cardToken); }
    public BookingRequest withCardToken(String value) { return new BookingRequest(roomId, checkIn, checkOut, guests, value); }
    public BookingRequest withRoomId(String value) { return new BookingRequest(value, checkIn, checkOut, guests, cardToken); }

    /** A change applied to a default request, e.g. {@code r -> r.withGuests(0)}. */
    @FunctionalInterface
    public interface Builder extends java.util.function.UnaryOperator<BookingRequest> {}
}
