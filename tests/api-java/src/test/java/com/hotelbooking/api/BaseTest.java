package com.hotelbooking.api;

import com.hotelbooking.api.clients.AuthClient;
import com.hotelbooking.api.clients.BookingClient;
import com.hotelbooking.api.clients.PaymentServiceClient;
import com.hotelbooking.api.clients.RoomClient;
import com.hotelbooking.api.clients.SystemClient;
import com.hotelbooking.api.data.Seed;
import com.hotelbooking.api.data.TestData;
import com.hotelbooking.api.data.Tokens;

/**
 * Base class of every test: clients, seed data, tokens and the test-data factory.
 *
 * - The seed is loaded once per run (first use of {@link Seed#get()}) and is read-only.
 * - Tests that change data create their own (see {@link TestData}).
 * - Tests run in parallel (src/test/resources/junit-platform.properties).
 */
public abstract class BaseTest {

    /** Name pattern for parameterized tests: keeps the catalog ID in every invocation's name. */
    protected static final String PARAMS = "{displayName} [{arguments}]";

    protected static final AuthClient auth = new AuthClient();
    protected static final RoomClient rooms = new RoomClient();
    protected static final BookingClient bookings = new BookingClient();
    protected static final PaymentServiceClient payments = new PaymentServiceClient();
    protected static final SystemClient system = new SystemClient();

    protected static final Seed seed = Seed.get();
    protected static final Tokens tokens = Tokens.get();

    protected final TestData data = new TestData(tokens);

    protected static final String UNKNOWN_ID = "00000000-0000-4000-8000-000000000000";
}
