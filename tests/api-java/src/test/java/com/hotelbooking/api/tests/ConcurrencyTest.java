package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.data.TestData.FreshUser;
import com.hotelbooking.api.model.Booking;
import com.hotelbooking.api.model.BookingRequest;
import com.hotelbooking.api.model.RegisterRequest;
import com.hotelbooking.api.model.Room;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static com.hotelbooking.api.core.Dates.day;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Concurrency")
class ConcurrencyTest extends BaseTest {

    /**
     * Runs all requests at the same moment: every thread waits at a "starting gate"
     * (CountDownLatch) until all threads are ready, then they fire together.
     */
    private static List<Response> inParallel(List<Callable<Response>> requests) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(requests.size());
        try {
            CountDownLatch gate = new CountDownLatch(1);
            List<Future<Response>> futures = new ArrayList<>();
            for (Callable<Response> request : requests) {
                futures.add(pool.submit(() -> {
                    gate.await();
                    return request.call();
                }));
            }
            gate.countDown();
            List<Response> responses = new ArrayList<>();
            for (Future<Response> future : futures) responses.add(future.get());
            return responses;
        } finally {
            pool.shutdownNow();
        }
    }

    private static List<Integer> statuses(List<Response> responses) {
        return responses.stream().map(Response::statusCode).sorted().toList();
    }

    @Test
    @Tag("regression")
    @DisplayName("CONC-001 Parallel identical bookings: exactly one wins")
    void parallelIdenticalBookings() throws Exception {
        Room room = data.createRoom();
        List<FreshUser> users = List.of(data.freshUser(), data.freshUser());
        BookingRequest request = BookingRequest.forRoom(room.id()).withDates(day(40), day(42));

        // 10 requests fired at the same time, alternating between two guests
        List<Callable<Response>> calls = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            String token = users.get(i % 2).token();
            calls.add(() -> data.book(token, request));
        }
        List<Response> responses = inParallel(calls);

        assertThat(statuses(responses)).as("statuses").containsExactly(201, 409, 409, 409, 409, 409, 409, 409, 409, 409);
        responses.stream().filter(r -> r.statusCode() == 409).forEach(r -> assertError(r, 409, "ROOM_UNAVAILABLE"));

        // State: exactly one CONFIRMED booking for the room across both users
        List<Booking> all = new ArrayList<>(data.allBookings(users.get(0).token()));
        all.addAll(data.allBookings(users.get(1).token()));
        assertThat(all).filteredOn(b -> b.roomId().equals(room.id()) && b.status().equals("CONFIRMED")).hasSize(1);
    }

    @Test
    @Tag("regression")
    @DisplayName("CONC-002 Parallel overlapping (not identical) stays")
    void parallelOverlappingStays() throws Exception {
        Room room = data.createRoom();
        String token = data.freshUser().token();
        List<Response> responses = inParallel(List.of(
                () -> data.book(token, BookingRequest.forRoom(room.id()).withDates(day(40), day(43))),
                () -> data.book(token, BookingRequest.forRoom(room.id()).withDates(day(42), day(45)))));
        assertThat(statuses(responses)).containsExactly(201, 409);
    }

    @Test
    @Tag("regression")
    @DisplayName("CONC-003 Parallel non-overlapping stays both succeed")
    void parallelNonOverlappingStays() throws Exception {
        Room room = data.createRoom();
        String token = data.freshUser().token();
        List<Response> responses = inParallel(List.of(
                () -> data.book(token, BookingRequest.forRoom(room.id()).withDates(day(40), day(42))),
                () -> data.book(token, BookingRequest.forRoom(room.id()).withDates(day(42), day(44)))));
        for (Response response : responses) assertOk(response, 201, "booking");
    }

    @Test
    @Tag("regression")
    @DisplayName("CONC-004 Parallel cancel of the same booking")
    void parallelCancel() throws Exception {
        Room room = data.createRoom();
        FreshUser user = data.freshUser();
        Booking booking = data.createBooking(user.token(), BookingRequest.forRoom(room.id()));
        List<Response> responses = inParallel(List.of(
                () -> bookings.cancel(user.token(), booking.id()),
                () -> bookings.cancel(user.token(), booking.id())));
        assertThat(statuses(responses)).containsExactly(200, 409);
        responses.stream().filter(r -> r.statusCode() == 409).forEach(r -> assertError(r, 409, "ALREADY_CANCELLED"));
    }

    @Test
    @Tag("regression")
    @DisplayName("CONC-005 Parallel register with the same email")
    void parallelRegister() throws Exception {
        RegisterRequest user = RegisterRequest.newUser();
        List<Response> responses = inParallel(List.of(() -> auth.register(user), () -> auth.register(user)));
        assertThat(statuses(responses)).containsExactly(201, 409);
        responses.stream().filter(r -> r.statusCode() == 409).forEach(r -> assertError(r, 409, "EMAIL_TAKEN"));
    }
}
