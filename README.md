# Hotel Booking System — QA Portfolio Project

A small hotel booking system that exists **to be tested**. The application is
deliberately simple. The focus is on testability, and later on API, E2E,
contract and performance test suites built on top of it.

> Status: **Phase 5 done**: booking-api + PostgreSQL + payment-service + React UI in Docker,
> a 184-case test catalog, two independent API suites (Playwright TypeScript and Java Rest
> Assured) covering every automated case, and Playwright E2E tests for the critical UI flows
> on Chromium and Firefox.

## Architecture

```
 browser ──> [frontend :5173]  nginx: static React app + proxy /api/* ──┐
                                                                        v
                               [booking-api :3000] ──HTTP──> [payment-service :4000]
                                        |
                                 [postgres :5432]
```

| Component | Tech | Phase |
|---|---|---|
| booking-api | Node 20, TypeScript, Express 5, Prisma, zod | 1 ✅ |
| database | PostgreSQL 16 | 1 ✅ |
| payment-service | Node 20, TypeScript, Express 5, in-memory storage | 2 ✅ |
| frontend | React 18, TypeScript, Vite, React Router; served by nginx | 4 ✅ |

The browser only talks to the frontend's origin. nginx forwards `/api/*` to booking-api
(`BOOKING_API_URL`), so the built app contains no API address and needs no CORS.

## How to run

Requirements: **Docker Desktop**. Nothing else is needed to run the system.

```bash
docker compose up --build
```

- **UI: http://localhost:5173**
- booking-api: http://localhost:3000. Swagger: http://localhost:3000/docs. Health: `/health`.
- payment-service: http://localhost:4000. Swagger: http://localhost:4000/docs. Health: `/health`.

Raw OpenAPI specs are at `/docs/openapi.json` on both services.

Stop with `Ctrl+C`, or `docker compose down` (add `-v` to also delete the database volume).

### Environments

All configuration comes from env files. Nothing is hardcoded in the code.

| File | Purpose | Committed |
|---|---|---|
| `.env.example` | Documents every variable | yes |
| `.env.test` | **Default** for docker compose. `APP_ENV=test`: test hooks enabled | yes (dummy values only) |
| `.env.dev` | `APP_ENV=dev`: test hooks return 404 | yes (dummy values only) |

To run with another env file:

```bash
ENV_FILE=.env.dev docker compose up --build
```

In PowerShell, set the variable first:

```powershell
$env:ENV_FILE=".env.dev"; docker compose up --build
```

Host ports can be changed with `FRONTEND_HOST_PORT`, `BOOKING_API_HOST_PORT`, `PAYMENT_SERVICE_HOST_PORT` and `POSTGRES_HOST_PORT`.

### Try it in the browser (2 minutes)

1. `POST /test/seed` once (Swagger, or `curl -X POST localhost:3000/test/seed`) to load the dataset.
2. Open http://localhost:5173 and **log in** as `guest1@hotel.test` (password: `SEED_GUEST1_PASSWORD` in `.env.test`).
3. **Search** dates a few weeks ahead (include a Friday to see the weekend surcharge) → **View & book**.
4. The room page shows the **price per night** and the total. Pick a **test card** and book:
   `tok_success` → confirmed · `tok_decline` → declined · `tok_slow` → times out after 3 s · `tok_error` → provider error.
5. **My bookings** lists every booking with its status. Cancel one (more than 48 h ahead).
6. Log in as `admin@hotel.test` → **Admin: rooms**: add a room, change a price, deactivate a room.

### Frontend development (optional)

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173, /api is proxied to BASE_URL from .env.test
```

### Try it in Swagger (2 minutes)

1. Open http://localhost:3000/docs
2. **Test hooks → `POST /test/seed`** → Execute. This loads the known dataset.
3. **Auth → `POST /auth/login`** with `guest1@hotel.test`. The password is
   `SEED_GUEST1_PASSWORD` in `.env.test`.
4. Copy `accessToken`, click **Authorize** (top right) and paste it.
5. **`GET /rooms/availability`** with `checkIn`/`checkOut` a few weeks ahead. Copy a room `id`.
6. **`POST /bookings`** with that `roomId`, the dates, `guests: 1` and `cardToken: "tok_success"` → **201 CONFIRMED**.

## Project layout

```
hotel-booking/
├── services/
│   ├── booking-api/
│   │   ├── prisma/schema.prisma          # tables
│   │   ├── prisma/migrations/            # SQL migrations (incl. overlap constraint)
│   │   ├── openapi.yaml                  # Swagger spec
│   │   └── src/
│   │       ├── index.ts / app.ts         # start-up, middleware, routes wiring
│   │       ├── config.ts                 # all env variables
│   │       ├── rules.ts                  # business rules 1-3, 13 (dates, cancellation)
│   │       ├── pricing.ts                # rule 10 (weekend surcharge, rounding)
│   │       ├── validation.ts             # request schemas → 400 errors
│   │       ├── errors.ts                 # AppError + error helpers
│   │       ├── mappers.ts                # DB row → JSON response (no passwordHash)
│   │       ├── middleware/               # auth (JWT), error handler
│   │       ├── routes/                   # auth, rooms, bookings, health, test hooks
│   │       ├── services/                 # booking create/cancel, payment-service HTTP client
│   │       └── testData/seed.ts          # dataset for POST /test/seed
│   └── payment-service/
│       ├── openapi.yaml
│       └── src/                          # app.ts (all endpoints), store.ts (in-memory), config.ts
├── frontend/
│   ├── nginx/default.conf.template       # serves the app, proxies /api → booking-api
│   └── src/
│       ├── api/                          # fetch client (ApiError), one function per endpoint, types
│       ├── auth/                         # AuthContext (token, 401 → re-login), route guards
│       ├── components/                   # Layout (nav), Alert, FieldError, StatusBadge
│       └── pages/                        # Login, Register, Search, Room, MyBookings, AdminRooms
├── docs/test-cases.md                    # test case catalog (single source of truth)
├── tests/
│   ├── schemas/                          # shared JSON schemas (data, used by both suites)
│   ├── api-playwright/                   # Playwright API suite (Phase 3b)
│   ├── api-java/                         # Java 21 + Rest Assured + Allure suite (Phase 3c)
│   └── e2e/                              # Playwright UI tests, Page Object Model (Phase 5)
│       ├── pages/                        # NavBar, SearchPage, RoomPage, MyBookingsPage, AdminRoomsPage
│       ├── src/                          # Api (setup via API), loginAs fixture, env
│       └── tests/                        # booking, cancellation, validation, admin
├── scripts/check-coverage.mjs            # lists catalog IDs missing from a suite
├── docker-compose.yml
├── .env.example / .env.dev / .env.test
└── README.md
```

## API overview

| Method | Path | Auth | Success | Main error codes |
|---|---|---|---|---|
| POST | /auth/register | – | 201 | 400, 409, 415 |
| POST | /auth/login | – | 200 | 400, 401 |
| GET | /auth/me | any | 200 | 401 |
| GET | /rooms | – | 200 | 400 |
| GET | /rooms/{id} | – | 200 | 404 |
| GET | /rooms/{id}/quote?checkIn&checkOut | – | 200 (price per night + total) | 400, 404, 409 |
| GET | /rooms/availability?checkIn&checkOut&guests&type | – | 200 | 400 |
| POST | /rooms | ADMIN | 201 + Location | 400, 401, 403, 409 |
| PUT | /rooms/{id} | ADMIN | 200 | 400, 401, 403, 404, **409** |
| PATCH | /rooms/{id} | ADMIN | 200 | 400, 401, 403, 404, 409 |
| POST | /bookings | any | 201 + Location | 400, 401, 402, 404, 409, 502, 504 |
| GET | /bookings | any | 200 (guest: own, admin: all) | 401 |
| GET | /bookings/{id} | owner/ADMIN | 200 | 401, 403, 404 |
| POST | /bookings/{id}/cancel | owner/ADMIN | 200 | 401, 403, 404, 409, 422 |
| GET | /health | – | 200 | 503 |
| POST | /test/reset | – (APP_ENV=test only) | 200 | 404 outside test |
| POST | /test/seed | – (APP_ENV=test only) | 200 | 404 outside test |

### Error format

Every 4xx/5xx is JSON:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "checkOut must be after checkIn", "field": "checkOut" } }
```

`field` is present only when one input field is at fault. `details` is present only when
there is extra data. For example, on payment errors `details.bookingId` is the booking
that was saved as `PAYMENT_FAILED`.

| code | status | when |
|---|---|---|
| `VALIDATION_ERROR` | 400 | missing/wrong-type/unknown field, bad date, business-rule validation |
| `INVALID_JSON` | 400 | body is not valid JSON |
| `AUTH_REQUIRED` | 401 | no `Authorization` header |
| `INVALID_TOKEN` | 401 | malformed header, bad signature, tampered token, user no longer exists |
| `TOKEN_EXPIRED` | 401 | token past its `exp` |
| `INVALID_CREDENTIALS` | 401 | wrong email **or** password (identical message) |
| `FORBIDDEN` | 403 | valid token, not allowed |
| `NOT_FOUND` | 404 | unknown resource or route |
| `EMAIL_TAKEN`, `ROOM_NUMBER_TAKEN` | 409 | duplicates |
| `ROOM_UNAVAILABLE` | 409 | overlapping booking |
| `ROOM_INACTIVE` | 409 | booking an inactive room |
| `ROOM_HAS_FUTURE_BOOKINGS` | 409 | deactivating a room with upcoming confirmed bookings |
| `ALREADY_CANCELLED`, `BOOKING_NOT_CANCELLABLE` | 409 | cancelling a cancelled / payment-failed booking |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | body sent with Content-Type other than `application/json` |
| `CANCELLATION_WINDOW_PASSED` | 422 | guest cancels ≤ 48h before check-in |
| `PAYMENT_DECLINED` | 402 | card declined (`tok_decline`) |
| `PAYMENT_SERVICE_ERROR` | 502 | payment-service returned 5xx or is unreachable |
| `PAYMENT_TIMEOUT` | 504 | payment-service connected but did not answer within 3 s |
| `INTERNAL_ERROR` | 500 | anything unexpected (never a stack trace) |

## Frontend testability (`data-testid` conventions)

Every interactive element and every important piece of text has a `data-testid`. Rules:

- **kebab-case**, `<page or area>-<element>`: `login-email`, `search-submit`, `booking-card-token`.
- **Rows carry their key**: room rows use the room **number** (`room-card-202`,
  `admin-room-toggle-301`), booking rows use the booking **id** (`booking-status-<id>`).
  The id of a new booking is in the URL after booking: `/bookings?created=<id>`.
- **Errors**: page-level errors are `<area>-error` (`login-error`, `booking-error`). Errors for
  one input are `<area>-error-<apiField>`, using the API's own field name:
  `booking-error-checkIn`, `register-error-password`, `admin-room-error-number`.
- **State as attributes**: status badges have `data-status="CONFIRMED"`. Rows have
  `data-booking-id` / `data-room-id`. Price rows have `data-weekend="true"`.

| Page | Key test ids |
|---|---|
| Nav | `nav-search`, `nav-my-bookings`, `nav-admin-rooms` (admins only), `nav-user`, `nav-user-role`, `nav-login`, `nav-logout` |
| Login / Register | `login-email`, `login-password`, `login-submit`, `login-error`, `login-session-expired`, `login-registered` · `register-full-name`, `register-email`, `register-password`, `register-submit`, `register-error-<field>` |
| Search `/` | `search-checkin`, `search-checkout`, `search-guests`, `search-type`, `search-submit`, `search-results` (`data-count`), `search-no-results`, `search-error-<field>`, `room-card-<number>`, `room-card-<number>-total`, `room-card-<number>-view` |
| Room `/rooms/:id` | `room-title`, `room-type`, `room-capacity`, `room-price-per-night`, `room-inactive`, `price-breakdown`, `price-night-<date>`, `price-total`, `booking-checkin`, `booking-checkout`, `booking-guests`, `booking-card-token`, `booking-submit`, `booking-submitting`, `booking-error`, `booking-error-message`, `booking-error-<field>`, `booking-login-required` |
| My bookings `/bookings` | `booking-created`, `bookings-table`, `bookings-empty`, `booking-row-<id>`, `booking-room-<id>`, `booking-dates-<id>`, `booking-total-<id>`, `booking-status-<id>`, `booking-cancel-<id>`, `booking-cancel-confirm-<id>`, `booking-cancel-abort-<id>`, `booking-error-<id>` |
| Admin `/admin/rooms` | `admin-room-number`, `admin-room-type`, `admin-room-capacity`, `admin-room-price`, `admin-room-active`, `admin-room-submit`, `admin-room-created`, `admin-room-error(-<field>)`, `admin-room-row-<number>`, `admin-room-status-<number>`, `admin-room-toggle-<number>`, `admin-room-price-input-<number>`, `admin-room-price-save-<number>`, `admin-room-row-error-<number>` |
| Guards | `access-denied` (logged-in guest on an admin page), `not-found` |

Form validation is **done by the API**, not duplicated in the browser. The UI shows the API's
message next to the field the API names, so UI tests check the real business rules.

## Payment flow

1. `POST /bookings` saves the booking as `PENDING_PAYMENT`. This already blocks the room.
2. booking-api calls `POST {PAYMENT_SERVICE_URL}/payments` with `{ bookingId, amount, cardToken }`
   and a **3 second timeout** (`PAYMENT_TIMEOUT_MS`).
3. The result is mapped as follows:

| cardToken | payment-service | booking status | booking-api response |
|---|---|---|---|
| `tok_success` | 201 `APPROVED` | `CONFIRMED` (paymentId set) | **201** + Location |
| `tok_decline` | 402 `DECLINED` | `PAYMENT_FAILED` (paymentId set) | **402** `PAYMENT_DECLINED` |
| `tok_slow` | answers after 5 s | `PAYMENT_FAILED` | **504** `PAYMENT_TIMEOUT` (after 3 s) |
| `tok_error` | 500 | `PAYMENT_FAILED` | **502** `PAYMENT_SERVICE_ERROR` |
| anything else | 400 | *nothing saved* (pending booking removed) | **400** `VALIDATION_ERROR`, field `cardToken` |
| *(any)*, payment-service down | no connection | `PAYMENT_FAILED` | **502** `PAYMENT_SERVICE_ERROR` |

On 402/502/504, the failed booking's id is in `error.details.bookingId`, so a test can check
its status with `GET /bookings/{id}`. `paymentId` can be looked up with payment-service
`GET /payments/{id}`.

**Timeout vs unreachable:** 504 means payment-service *accepted the connection* but did not
answer in time. If no connection can be made, the response is 502, even when that takes the
full 3 s. For example, Docker's DNS takes about 4 s to report a stopped container as missing.

To try it: `docker compose stop payment-service`, then book → 502. `docker compose start payment-service` to recover.

## Testability hooks

- **Swagger / OpenAPI** at `/docs` and `/docs/openapi.json`.
- **`POST /test/reset`** wipes all data. **`POST /test/seed`** wipes, then loads the dataset below
  and returns every created user, room and booking, so tests can use their ids.
  Both exist only when `APP_ENV=test`; otherwise they return 404 and are hidden from Swagger.
- **`X-Test-Now` header** (`APP_ENV=test` only): `X-Test-Now: 2026-12-01T12:00:00Z` makes that
  request treat the given time as "now". Use it to test the 48h cancellation rule to the
  second, past dates and the 365-day window, with no sleeps.
- **`GET /health`** checks the database: 200 when it is up, 503 when it is down.
- **`JWT_SECRET`** is in `.env.test`, so tests can sign their own expired or tampered tokens.

### Seed dataset (`POST /test/seed`)

Passwords come from the `SEED_*` variables. Booking dates are **relative to today**, so the
seed never goes out of date.

| Users | role |
|---|---|
| `SEED_ADMIN_EMAIL` (Alice Admin) | ADMIN |
| `SEED_GUEST1_EMAIL` (Gina Guest) | GUEST |
| `SEED_GUEST2_EMAIL` (Gary Guest) | GUEST |

| Room | type | capacity | price/night | active |
|---|---|---|---|---|
| 101 | SINGLE | 1 | 80.00 | ✅ |
| 102 | SINGLE | 2 | 95.50 | ✅ |
| 201 | DOUBLE | 2 | 120.00 | ✅ |
| 202 | DOUBLE | 3 | 145.75 | ✅ |
| 301 | SUITE | 4 | 250.00 | ✅ |
| 302 | SUITE | 6 | 399.99 | ❌ inactive |

| Booking | owner | room | dates (days from today) | status | useful for |
|---|---|---|---|---|---|
| 1 | guest1 | 201 | +10 → +13 | CONFIRMED | free cancellation, overlap tests |
| 2 | guest1 | 202 | +20 → +22 | CANCELLED | cancelled frees room, cancel twice → 409 |
| 3 | guest1 | 102 | +40 → +42 | PENDING_PAYMENT | pending blocks the room |
| 4 | guest2 | 101 | +5 → +7 | PAYMENT_FAILED | failed payment frees room |
| 5 | guest2 | 301 | +30 → +35 | CONFIRMED | room 301 cannot be deactivated |
| 6 | guest2 | 201 | +1 → +2 | CONFIRMED | guest cancel inside 48h → 422 |

## Business rules: implementation decisions

These are decisions where PROJECT_PLAN.md left room for interpretation:

1. **Time zone**: all calendar dates are UTC. "Today" means today in UTC.
2. **Check-in time** is 14:00 UTC (`CHECKIN_HOUR_UTC`). A guest may cancel for free only if
   `checkIn 14:00 UTC − now > 48h`. Exactly 48h counts as too late (→ 422).
3. **365-day window** applies to `checkIn`: `checkIn ≤ today + 365`.
4. **Max stay** is 30 nights: 30 is allowed, 31 → 400.
5. **Weekend surcharge**: a night costs +20% if it *starts* on Friday or Saturday. Nightly
   prices are summed at full precision, and the **total** is rounded once, half-up, to 2 decimals.
6. **Blocking statuses**: `PENDING_PAYMENT` and `CONFIRMED` block a room. `PAYMENT_FAILED` and
   `CANCELLED` do not.
7. **Concurrency** is enforced by PostgreSQL. A `btree_gist` **exclusion constraint**
   (`bookings_no_overlap`) on `(roomId, daterange(checkIn, checkOut, '[)'))` covers blocking
   statuses only. Two simultaneous requests can never both succeed; the loser gets 409.
8. **Inactive room**: booking it → 409 `ROOM_INACTIVE`. `GET /rooms` and availability hide it.
   `GET /rooms/{id}` still returns it, with `isActive: false`. Admins can list it with
   `GET /rooms?includeInactive=true`.
9. **PUT vs PATCH** (rooms): PUT replaces number/type/capacity/pricePerNight, and sending
   `isActive` to PUT → 400. A duplicate `number` → 409, on PUT too (added to the table).
   PATCH changes only the fields sent and is how a room is (de)activated.
10. **Deactivation (rule 16)** is blocked by any CONFIRMED booking whose checkout is after today
    (upcoming *or* ongoing stays).
11. **Cancelling a `PAYMENT_FAILED` booking** → 409 `BOOKING_NOT_CANCELLABLE`.
12. **Unknown body fields** → 400 (`Unknown field: x`). Unknown query parameters are ignored.
13. **Wrong Content-Type** → **415** (the plan's table only lists 400s; 415 is the correct HTTP code).
14. **Register** always creates a `GUEST`. Admin accounts come only from the seed.
    Passwords must be 8–72 characters. Emails are stored lowercase.
15. **IDs** are UUIDs. A non-UUID id in a path → 404.
16. **The role is read from the database** on every request, never trusted from the token.

## Test strategy

_The full test pyramid explanation follows in later phases. This section currently covers the API layer._

### Test case catalog

[`docs/test-cases.md`](docs/test-cases.md) is the single source of truth: **184 cases** with an
ID, category, preconditions, steps, expected status and result, priority and tag. Every
automated test has its catalog ID in its name, so the report, the catalog and the code can be
traced both ways. Response bodies are checked against the shared JSON schemas in
[`tests/schemas/`](tests/schemas).

| Area | IDs | | Area | IDs |
|---|---|---|---|---|
| Health | HLTH-001…003 | | Availability & overlap | AVAIL-001…020 |
| Authentication | AUTH-001…023 | | Booking & boundaries | BOOK-001…022 |
| Authorization | AUTHZ-001…013 | | Pricing | PRICE-001…009 |
| Validation | VAL-001…023 | | Payment / payment-service | PAY-001…007, PSVC-001…007 |
| Rooms | ROOM-001…025 | | Cancellation / Concurrency | CANC-001…012, CONC-001…005 |
| Response checks | RESP-001…009 | | Price quote | QUOTE-001…006 |

### Running the API tests

Start the system first (`docker compose up --build`). Then:

**Playwright (TypeScript)** — `tests/api-playwright/`

```bash
cd tests/api-playwright
npm ci
npm test                  # everything (~25 s, 4 workers)
npm run test:smoke        # @smoke only (16 tests, ~5 s)
npm run test:regression   # @regression only
npm run report            # open the HTML report (playwright-report/index.html)
```

No browsers are needed: the suite uses Playwright's API request client only.

**Java + Rest Assured** — `tests/api-java/` (needs **JDK 21+**; Maven comes with the wrapper)

```bash
cd tests/api-java
./mvnw clean verify                  # everything + Allure report (~65 s incl. Maven start-up)
./mvnw clean verify -Dgroups=smoke   # smoke only (16 tests)
./mvnw allure:serve                  # open the Allure report in a browser
```

```
src/test/java/com/hotelbooking/api/
├── BaseTest.java          # clients, seed, tokens, test-data factory for every test class
├── config/Config.java     # env variables (+ .env file fallback)
├── core/                  # Specs (request/response specifications + Allure filter),
│                          # SchemaValidator (draft-07), ApiAssertions, Dates, Jwt, PriceOracle
├── clients/               # AuthClient, RoomClient, BookingClient, PaymentServiceClient, SystemClient
├── model/                 # records: Booking, Room, User, BookingRequest, RoomRequest, ApiError…
├── data/                  # Seed (seed once), Tokens, TestData (OWN_ROOM, fresh users, bookings)
└── tests/                 # one class per catalog area; @Tag("smoke"/"regression"), @ParameterizedTest
```

On Windows use `mvnw.cmd`. The static report is written to `target/allure-report/index.html`.
Tests run in Maven's `integration-test` phase (Failsafe). The Allure report is built right
after, and only then does `verify` fail the build if a test failed. So the report always
exists and the exit code is still correct. A JDK older than 21 stops the build with a clear
message (Maven Enforcer).

Both suites read their configuration the same way: environment variables first, then the
env file (`.env.test` by default, `ENV_FILE=.env.dev` to change it).

> Don't run two suites (API or E2E) **at the same time** against the same stack: each one
> re-seeds the database when it starts. In CI they run as separate jobs, each with its own stack.

**Coverage check**: lists catalog IDs that a suite does not implement:

```bash
node scripts/check-coverage.mjs              # both suites (currently 183/183 each)
node scripts/check-coverage.mjs playwright   # one suite: playwright | java
```

### End-to-end UI tests (Playwright) — `tests/e2e/`

```bash
cd tests/e2e
npm ci
npm run install-browsers   # once: Playwright's Chromium and Firefox
npm test                   # headless, Chromium + Firefox (~55 s)
npm run test:headed        # same, with visible browser windows
npm run test:chromium      # or test:firefox: one browser only
npm run report             # HTML report (playwright-report/index.html)
```

Only the **critical flows** are tested in the UI. Everything else is covered faster and more
precisely by the API suites:

| ID | Flow | Checks |
|---|---|---|
| E2E-001 | Guest searches, books, sees the booking as CONFIRMED | search result and room page show the API's price; 3-night breakdown; redirect + banner; status `CONFIRMED`; API agrees |
| E2E-002 | Declined payment | clear error on the room page; the attempt is listed as `PAYMENT_FAILED` and cannot be cancelled |
| E2E-003 | Guest cancels a booking | two-step cancel → `CANCELLED`, button gone, still cancelled after reload, API agrees |
| E2E-004 | Booking form validation | past date and check-out before check-in each show the API message under the right field; submitting anyway books nothing; the message clears once fixed |
| E2E-005 | Admin creates a room, a guest finds it | admin creates it in the UI; a guest in a **separate browser session** finds it in search |
| E2E-006 | Guest cannot access the admin page | logged-in guest sees "Access denied" and no admin link; anonymous user is sent to login |

**Design**

- **Page Object Model.** Tests talk to page objects (`RoomPage.book('tok_decline')`), and page
  objects use `data-testid` locators only. When markup changes, only the page objects change.
- **Setup through the API, UI only for the flow under test.** Each test creates its own room
  and a fresh guest via the API. **Login is via the API** too: `loginAs(page, session)` writes
  the token to the app's sessionStorage before the page loads, so no test types into the login
  form unless login is what it tests.
- **Expected values come from the API**, e.g. the expected price comes from
  `GET /rooms/{id}/quote`, so E2E tests check that the UI shows the API's truth.
  Important results are also double-checked through the API ("the UI tells the truth").
- **Failure artifacts**: `screenshot: only-on-failure`, `video` and `trace: retain-on-failure`,
  saved in `test-results/<test>-<browser>/`. Open a trace with
  `npx playwright show-trace test-results/<folder>/trace.zip`. A green run leaves nothing behind.
  This was verified with a *real* failure: with payment-service stopped, E2E-001 failed in both
  browsers and each saved a screenshot (showing the "payment provider is unavailable" message),
  a video and a trace.

### How the suites stay independent and stable

- `POST /test/seed` runs **once** (Playwright `globalSetup`; in Java, the first use of `Seed.get()`). After that, seed data is read-only.
  Any test that changes data creates its own room, user and bookings, so tests running in
  parallel never compete for the same dates.
- State checks ("nothing changed after a failed write") use a **freshly registered user**,
  because the seeded guests are shared by parallel tests.
- Time-based rules (48 h cancellation, past dates, the 365-day window) use the
  `X-Test-Now` header, so there are **no sleeps** and boundaries are exact to the second.
- Pricing expectations come from an **independent oracle**
  ([`pricing.ts`](tests/api-playwright/src/pricing.ts) /
  [`PriceOracle.java`](tests/api-java/src/test/java/com/hotelbooking/api/core/PriceOracle.java)),
  not a copy of the API code.
- No retries are configured: a flaky API test is a bug to find, not to hide.

### Bug found by the suite

The concurrency test **CONC-002** (two *overlapping but different* stays booked at the same
moment) failed about once in 40 runs. booking-api returned **500** instead of 409. The cause
was a PostgreSQL **deadlock** (`40P01`). The exclusion constraint makes each insert or update
wait for the other request's uncommitted row, so Postgres aborted one of them. Double booking
was still prevented, but the API answered wrongly. Fix: `retryOnDeadlock()` in
[`db.ts`](services/booking-api/src/db.ts) retries the aborted write, which then fails cleanly
with 409. Verified with 500 repeated concurrency runs (7 deadlocks occurred, all handled, no 500s).

### Playwright vs Rest Assured: the same test in both

Both suites implement the **same 183 automated catalog cases** with the same shared JSON schemas and
the same env variables. They share no code. Here is **PAY-002** (declined payment, verified
with follow-up GETs on both services) in each.

<table>
<tr><th>Playwright (TypeScript)</th><th>Rest Assured (Java 21 + JUnit 5 + AssertJ)</th></tr>
<tr><td>

```ts
test('PAY-002 Declined payment', smoke,
  async ({ pay, tokens, data }) => {
  const room = await data.createRoom();
  const res = await data.book(tokens.g1, room.id,
    { cardToken: 'tok_decline' });
  expectError(res, 402, 'PAYMENT_DECLINED');
  const bookingId =
    res.body.error.details?.bookingId;
  expect(bookingId).toBeTruthy();

  const booking =
    await data.getBooking(bookingId, tokens.g1);
  expect(booking.status).toBe('PAYMENT_FAILED');
  expect(booking.paymentId).not.toBeNull();

  const payment =
    await pay.get(`/payments/${booking.paymentId}`);
  expectOk(payment, 200, 'payment');
  expect(payment.body.status).toBe('DECLINED');
});
```

</td><td>

```java
@Test
@Tag("smoke")
@DisplayName("PAY-002 Declined payment")
void declinedPayment() {
    Response response = bookWithCard("tok_decline");
    assertError(response, 402, "PAYMENT_DECLINED");

    Booking booking = failedBooking(response);
    assertThat(booking.status())
        .isEqualTo("PAYMENT_FAILED");
    assertThat(booking.paymentId()).isNotNull();

    Response payment =
        payments.get(booking.paymentId());
    assertOk(payment, 200, "payment");
    assertThat(payment.jsonPath().getString("status"))
        .isEqualTo("DECLINED");
}
```

</td></tr>
</table>

The tests read almost the same because both suites use the same layers: clients, a
test-data factory, `expectError`/`assertError` for the error format, and schema assertions.
The differences are in everything around the test:

| | Playwright (TypeScript) | Rest Assured (Java) |
|---|---|---|
| **Size** | 21 files · ~1,500 lines of tests + ~500 helper | 43 files · ~2,350 lines of tests + ~1,000 helper (+ pom) |
| **Full run (261 tests, 4 parallel)** | ~25 s | ~65 s incl. Maven start-up and Allure generation |
| **Typing of bodies** | Structural (`any`/interfaces). Quick to write, typos show up at runtime | Records (`Booking`, `Room`…) and `BigDecimal` for money. The compiler catches field mistakes |
| **Bad-input tests** | Trivial: a body is just an object | Needs `Map<String,Object>` to send wrong types or missing fields (records can't) |
| **Parameterized tests** | A `for` loop around `test()` | `@ParameterizedTest` + `@CsvSource`/`@MethodSource`, with richer naming and reporting |
| **Global setup** | Built in (`globalSetup`) | No suite-level hook in JUnit; a lazy, synchronized singleton (`Seed.get()`) |
| **Parallelism** | Workers out of the box (`fullyParallel`) | `junit-platform.properties`; shared state must be thread-safe |
| **Concurrency test** | `Promise.all([...])` (requests start together) | `ExecutorService` + `CountDownLatch` "starting gate" (more code, more control) |
| **Report** | HTML report built in, zero setup | Allure: richer (epics/features, request/response attached to every step, history), but needs a plugin and CLI |
| **Tooling** | `npm ci` and go. No browsers needed for API tests | JDK 21 + Maven wrapper. Familiar in enterprise and Java CI ecosystems |
| **Same stack as the E2E tests** | Yes: one tool for API and UI (Phase 5) | No |

**Choosing:** for a TypeScript team, or when API and E2E tests should share one tool,
Playwright is the lighter choice. Rest Assured fits a Java/JVM organisation that wants
compile-time typed models and Allure-style reporting. This project keeps both to show the
same test design (catalog → IDs → shared schemas) working in both ecosystems.

## Known limitations

- **tok_slow leaves the two services out of sync.** booking-api gives up after 3 s and marks
  the booking `PAYMENT_FAILED`. payment-service still approves the payment 2 s later, so a
  "charged but not booked" payment exists. A real system would need a refund or reconciliation
  job. Here it is left as a realistic, testable inconsistency.
- payment-service stores payments in memory, so they are lost when its container restarts.
- No idempotency keys: retrying a booking request creates a new booking attempt.
- No refresh tokens. The access token simply expires after 15 minutes. The UI then sends the
  user to the login page with a "session expired" message.
- Validation messages in the UI are the API's own (e.g. "checkOut must be after checkIn"):
  consistent and testable, but they use field names rather than polished copy.
- No rate limiting (planned for v3 security checks).
