package com.hotelbooking.api.model;

import java.util.List;

/** Response of POST /test/seed. */
public record SeedData(List<User> users, List<Room> rooms, List<Booking> bookings) {}
