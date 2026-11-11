package com.hotelbooking.api.data;

import com.hotelbooking.api.clients.SystemClient;
import com.hotelbooking.api.config.Config;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.Room;
import com.hotelbooking.api.model.SeedData;
import com.hotelbooking.api.model.User;

import java.util.Comparator;
import java.util.List;

/**
 * The seeded dataset. POST /test/seed runs ONCE per test run (the first time {@link #get()}
 * is called). After that the seed data is READ-ONLY for tests (catalog rule 1.2.1).
 */
public final class Seed {

    private static Seed instance;
    private final SeedData data;

    private Seed(SeedData data) {
        this.data = data;
    }

    public static synchronized Seed get() {
        if (instance == null) {
            SystemClient system = new SystemClient();
            if (system.health().statusCode() != 200) {
                throw new IllegalStateException("booking-api is not healthy at " + Config.baseUrl()
                        + ". Start it with: docker compose up --build");
            }
            var response = system.seed();
            if (response.statusCode() != 200) {
                throw new IllegalStateException("POST /test/seed returned " + response.statusCode()
                        + ". Is APP_ENV=test? Body: " + response.asString());
            }
            instance = new Seed(response.as(SeedData.class));
        }
        return instance;
    }

    public User admin() { return user(Config.admin().email()); }
    public User g1() { return user(Config.guest1().email()); }
    public User g2() { return user(Config.guest2().email()); }

    /** R101 … R302 */
    public Room room(String number) {
        return data.rooms().stream().filter(r -> r.number().equals(number)).findFirst()
                .orElseThrow(() -> new IllegalStateException("Seed room " + number + " not found"));
    }

    /** SB1 … SB6, as described in docs/test-cases.md section 1.3. */
    public Booking booking(int n) {
        return switch (n) {
            case 1 -> inRoom("201", "CONFIRMED").getLast();   // D+10, the later one
            case 2 -> inRoom("202", "CANCELLED").getFirst();
            case 3 -> inRoom("102", "PENDING_PAYMENT").getFirst();
            case 4 -> inRoom("101", "PAYMENT_FAILED").getFirst();
            case 5 -> inRoom("301", "CONFIRMED").getFirst();
            case 6 -> inRoom("201", "CONFIRMED").getFirst();  // D+1, the earlier one
            default -> throw new IllegalArgumentException("No seed booking SB" + n);
        };
    }

    private User user(String email) {
        return data.users().stream().filter(u -> u.email().equals(email)).findFirst()
                .orElseThrow(() -> new IllegalStateException("Seed user " + email + " not found"));
    }

    private List<Booking> inRoom(String number, String status) {
        String roomId = room(number).id();
        return data.bookings().stream()
                .filter(b -> b.roomId().equals(roomId) && b.status().equals(status))
                .sorted(Comparator.comparing(Booking::checkIn))
                .toList();
    }
}
