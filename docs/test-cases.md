# API Test Case Catalog

This is the single source of truth for both API test suites:

- `tests/api-playwright/` (Playwright, TypeScript)
- `tests/api-java/` (JUnit 5, Rest Assured)

Every case has an ID (`AUTH-003`). Both suites must reference that ID in the test name
or tag. A coverage script lists IDs missing from either suite. It reads the IDs from the
**first column of the tables below**, using the regex `^[A-Z]+-\d{3}$`.

Response bodies are checked against the shared JSON schemas in [`tests/schemas/`](../tests/schemas).

---

## 1. Conventions

### 1.1 Notation

| Notation | Meaning |
|---|---|
| `ADMIN`, `G1`, `G2` | Seeded admin, guest 1 and guest 2. Credentials come from `SEED_*` env variables. |
| `T(X)` | A valid access token for user X, from `POST /auth/login`. |
| `R101` … `R302` | Seeded rooms by number. `R302` is **inactive**. |
| `SB1` … `SB6` | Seeded bookings, see 1.3. |
| `D+n` | Today in UTC plus *n* days, formatted `YYYY-MM-DD`. `D+0` is today, `D-1` is yesterday. |
| `MON` | The first **Monday** on or after `D+60`. `MON+n` is *n* days after it (`MON+4` is Friday). |
| `OWN_ROOM` | A room the test creates itself (as ADMIN) with `NEW_ROOM`. Capacity 2, price 100.00. |
| `NEW_ROOM` | `{"number": "<unique>", "type": "DOUBLE", "capacity": 2, "pricePerNight": 100}`. `<unique>`: 1–10 characters `[A-Za-z0-9-]`, e.g. `T` + 6 random characters. |
| `NEW_USER` | `{"email": "<unique>@example.test", "password": "Secret123!", "fullName": "Test User"}` |
| `BOOKING` | `{"roomId": OWN_ROOM.id, "checkIn": "D+30", "checkOut": "D+32", "guests": 1, "cardToken": "tok_success"}`. Rows say which fields to override. |
| `CHECKIN(b)` | Booking b's check-in moment: its `checkIn` date at 14:00:00Z (`CHECKIN_HOUR_UTC`). |
| `X-Test-Now: t` | Request header that makes booking-api treat `t` as "now". Works only with `APP_ENV=test`. |
| `{BASE}` / `{PAY}` | `BASE_URL` (booking-api) / `PAYMENT_URL` (payment-service). Paths without a prefix go to `{BASE}`. |
| `UNKNOWN_ID` | A valid but non-existent UUID, e.g. `00000000-0000-4000-8000-000000000000`. |

### 1.2 Rules for every test (both suites)

1. **Independence.** `POST /test/seed` runs **once**, before the suite (global setup).
   After that, seed data is **read-only**: a test may read it and may run *failing* writes
   against it, but may not change it. A test that changes data creates its own data
   (`OWN_ROOM`, `NEW_USER`, its own bookings). Because each booking test uses its own room,
   tests never fight over dates. No test depends on another test or on run order.
2. **No absolute counts on shared lists.** Other tests create rooms and bookings at the same
   time. Assert that specific items are in or not in a list, never `total == N`. Exception:
   lists filtered to the test's own data.
3. **Schema.** Every response with a body is checked against its schema:

   | Response | Schema |
   |---|---|
   | any 4xx/5xx | `error.schema.json` |
   | `GET /health` (both services) | `health.schema.json` |
   | `POST /auth/register`, `GET /auth/me` | `user.schema.json` |
   | `POST /auth/login` | `login-response.schema.json` |
   | `GET /rooms/{id}`, `POST/PUT/PATCH /rooms…` | `room.schema.json` |
   | `GET /rooms` | `room-list.schema.json` |
   | `GET /rooms/availability` | `availability-list.schema.json` |
   | `POST /bookings`, `GET /bookings/{id}`, `POST /bookings/{id}/cancel` | `booking.schema.json` |
   | `GET /bookings` | `booking-list.schema.json` |
   | payment-service `POST /payments` (201), `GET /payments/{id}` | `payment.schema.json` |
   | `GET /rooms/{id}/quote` | `quote.schema.json` |

4. **Errors.** When a row gives an error code (e.g. `409 ROOM_UNAVAILABLE`), assert both the
   HTTP status and `error.code`. Where a field is given, also assert `error.field`.
5. **State verification.** Every failed write ends with a read that proves nothing changed
   (column *Expected result*, "State:"). A typical check: the user's `GET /bookings` total is
   unchanged, or the room/booking still has its old values. **A test that checks a booking
   total acts as a freshly registered guest (`NEW_USER`)**, not as G1/G2. G1 and G2 are shared
   by parallel tests, so their totals change at any moment. Where such a row says `T(G1)` or
   "G2 books", read it as "a guest".
6. **No fixed sleeps.** Time-dependent rules use `X-Test-Now`, never waiting.
7. **Tags.** `smoke` = critical happy paths, run first. `regression` = everything else.
   `manual` = documented but not automated, and excluded from the coverage script.
8. **Priority.** P1 = core business rule or security; P2 = important; P3 = edge case.

### 1.3 Seed data used by the catalog

| Booking | Owner | Room | Dates | Status |
|---|---|---|---|---|
| `SB1` | G1 | R201 | D+10 → D+13 | CONFIRMED |
| `SB2` | G1 | R202 | D+20 → D+22 | CANCELLED |
| `SB3` | G1 | R102 | D+40 → D+42 | PENDING_PAYMENT |
| `SB4` | G2 | R101 | D+5 → D+7 | PAYMENT_FAILED |
| `SB5` | G2 | R301 | D+30 → D+35 | CONFIRMED |
| `SB6` | G2 | R201 | D+1 → D+2 | CONFIRMED (inside the 48h window) |

Rooms: R101 SINGLE cap 1 (80.00) · R102 SINGLE cap 2 (95.50) · R201 DOUBLE cap 2 (120.00) ·
R202 DOUBLE cap 3 (145.75) · R301 SUITE cap 4 (250.00) · R302 SUITE cap 6 (399.99, **inactive**).

---

## 2. Test cases

### 2.1 Health (HLTH)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| HLTH-001 | Health | booking-api health reports database up | – | `GET /health` | 200 | `status=ok`, `service=booking-api`, `database=up` | P1 | smoke |
| HLTH-002 | Health | payment-service health | – | `GET {PAY}/health` | 200 | `status=ok`, `service=payment-service` | P1 | smoke |
| HLTH-003 | Health | OpenAPI spec lists every endpoint | – | `GET /docs/openapi.json` | 200 | `paths` contains all 9 booking-api paths of the endpoint table + `/health` | P3 | regression |

### 2.2 Authentication (AUTH)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| AUTH-001 | Auth | Register a new guest | – | `POST /auth/register` `NEW_USER` | 201 | `role=GUEST`, `email` equals the sent email; no password-related field in the body | P1 | smoke |
| AUTH-002 | Auth | Register stores the email in lowercase | – | `POST /auth/register` with email `Mixed.<unique>@Example.TEST` | 201 | `email` is all lowercase | P3 | regression |
| AUTH-003 | Auth | Register with an existing email | user U registered | `POST /auth/register` with U's email, other password | 409 `EMAIL_TAKEN` | State: login with U's **original** password still returns 200 | P1 | regression |
| AUTH-004 | Auth | Register duplicate email with different case | user U registered (lowercase email) | `POST /auth/register` with U's email in UPPERCASE | 409 `EMAIL_TAKEN` | – | P2 | regression |
| AUTH-005 | Auth | Register cannot set role (mass assignment) | – | `POST /auth/register` `NEW_USER` + `"role": "ADMIN"` | 400 `VALIDATION_ERROR` field `role` | Message `Unknown field: role`. State: login with that email → 401 (no user created) | P1 | regression |
| AUTH-006 | Auth | Register with invalid email format | – | `POST /auth/register` email = each of: `plainaddress`, `a@`, `@b.test`, `a b@c.test` | 400 `VALIDATION_ERROR` field `email` | Parameterized, one run per value | P2 | regression |
| AUTH-007 | Auth | Password length boundaries | – | `POST /auth/register` with password length 7 / 8 / 72 / 73 | 400 / 201 / 201 / 400 | 400 cases: field `password`. Parameterized | P2 | regression |
| AUTH-008 | Auth | Register with an empty or whitespace-only full name | – | `POST /auth/register` fullName `""` and `"   "` | 400 `VALIDATION_ERROR` field `fullName` | Parameterized | P3 | regression |
| AUTH-009 | Auth | Valid login | – | `POST /auth/login` G1 credentials | 200 | `tokenType=Bearer`, `expiresIn=900`, `user.email` = G1, `user.role=GUEST`, `accessToken` is a JWT | P1 | smoke |
| AUTH-010 | Auth | Login with wrong password | – | `POST /auth/login` G1 email + `WrongPass1!` | 401 `INVALID_CREDENTIALS` | Message `Invalid email or password` | P1 | smoke |
| AUTH-011 | Auth | Login with unknown email gives the same message | – | `POST /auth/login` `nobody-<unique>@example.test` + any password | 401 `INVALID_CREDENTIALS` | Body is **identical** to AUTH-010's (no user enumeration) | P1 | regression |
| AUTH-012 | Auth | Login email is case-insensitive | – | `POST /auth/login` G1 email in UPPERCASE + G1 password | 200 | `user.email` = G1 (lowercase) | P3 | regression |
| AUTH-013 | Auth | Admin login returns ADMIN role | – | `POST /auth/login` ADMIN credentials | 200 | `user.role=ADMIN` | P1 | smoke |
| AUTH-014 | Auth | /auth/me with valid token | – | `GET /auth/me` with `T(G1)` | 200 | `id`, `email`, `role` match G1 | P1 | smoke |
| AUTH-015 | Auth | /auth/me without token | – | `GET /auth/me`, no Authorization header | 401 `AUTH_REQUIRED` | – | P1 | regression |
| AUTH-016 | Auth | Malformed Authorization header | – | `GET /auth/me` with header = each of: `Token <T(G1)>`, `Bearer`, `<T(G1)>` (no scheme), `Bearer <T(G1)> extra`, `bearer <T(G1)>` | 401 `INVALID_TOKEN` | Parameterized | P2 | regression |
| AUTH-017 | Auth | Invalid (garbage) token | – | `GET /auth/me` with `Bearer not.a.jwt` | 401 `INVALID_TOKEN` | – | P1 | regression |
| AUTH-018 | Auth | Expired token | `JWT_SECRET` from env | Sign HS256 `{sub: G1.id, role: GUEST, iat: now-1000, exp: now-10}` with `JWT_SECRET`; `GET /auth/me` | 401 `TOKEN_EXPIRED` | – | P1 | regression |
| AUTH-019 | Auth | Tampered token: role changed to ADMIN | – | Take `T(G1)`, base64url-decode the payload, set `role: ADMIN`, re-encode, **keep the original signature**; `GET /auth/me`, then `POST /rooms` `NEW_ROOM` | 401 `INVALID_TOKEN` (both) | State: room number from the body not found in admin `GET /rooms?includeInactive=true` | P1 | regression |
| AUTH-020 | Auth | Token signed with the wrong secret | – | Sign a valid-looking payload for G1 with secret `wrong-secret`; `GET /auth/me` | 401 `INVALID_TOKEN` | – | P2 | regression |
| AUTH-021 | Auth | Unsigned token (`alg: none`) | – | Header `{"alg":"none"}`, payload for G1, empty signature; `GET /auth/me` | 401 `INVALID_TOKEN` | – | P2 | regression |
| AUTH-022 | Auth | Correctly signed token for a non-existent user | `JWT_SECRET` from env | Sign `{sub: UNKNOWN_ID, role: ADMIN, exp: now+600}` with `JWT_SECRET`; `GET /auth/me` | 401 `INVALID_TOKEN` | – | P3 | regression |
| AUTH-023 | Auth | Role is read from the database, not the token | `JWT_SECRET` from env | Sign `{sub: G1.id, role: ADMIN, exp: now+600}` with `JWT_SECRET` (valid signature); `POST /rooms` `NEW_ROOM` | 403 `FORBIDDEN` | State: room not created | P2 | regression |

### 2.3 Authorization (AUTHZ)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| AUTHZ-001 | Authorization | Guest cannot create a room | – | `POST /rooms` `NEW_ROOM` with `T(G1)` | 403 `FORBIDDEN` | State: number not in admin `GET /rooms?includeInactive=true` | P1 | regression |
| AUTHZ-002 | Authorization | Guest cannot replace a room | `OWN_ROOM` | `PUT /rooms/{OWN_ROOM.id}` `NEW_ROOM` with price 1 with `T(G1)` | 403 `FORBIDDEN` | State: `GET /rooms/{id}` unchanged | P1 | regression |
| AUTHZ-003 | Authorization | Guest cannot patch/deactivate a room | `OWN_ROOM` | `PATCH /rooms/{OWN_ROOM.id}` `{"isActive": false}` with `T(G1)` | 403 `FORBIDDEN` | State: room still active | P1 | regression |
| AUTHZ-004 | Authorization | Room write endpoints require a token | `OWN_ROOM` | Without a token: `POST /rooms`, `PUT /rooms/{id}`, `PATCH /rooms/{id}` | 401 `AUTH_REQUIRED` | Parameterized per endpoint. State: room unchanged / not created | P1 | regression |
| AUTHZ-005 | Authorization | Booking endpoints require a token | `SB1` | Without a token: `POST /bookings` `BOOKING`, `GET /bookings`, `GET /bookings/{SB1}`, `POST /bookings/{SB1}/cancel` | 401 `AUTH_REQUIRED` | Parameterized per endpoint. State: SB1 still CONFIRMED | P1 | regression |
| AUTHZ-006 | Authorization | Guest sees only own bookings | – | `GET /bookings?limit=100` with `T(G2)` | 200 | Every item `userId` = G2.id; contains SB4, SB5, SB6; contains none of SB1–SB3 | P1 | regression |
| AUTHZ-007 | Authorization | Admin sees all bookings | – | `GET /bookings?limit=100` with `T(ADMIN)` (page through if needed) | 200 | Contains SB1…SB6 (bookings of both guests) | P1 | regression |
| AUTHZ-008 | Authorization | Guest cannot read another guest's booking | – | `GET /bookings/{SB1}` with `T(G2)` | 403 `FORBIDDEN` | – | P1 | regression |
| AUTHZ-009 | Authorization | Guest cannot cancel another guest's booking | – | `POST /bookings/{SB1}/cancel` with `T(G2)` | 403 `FORBIDDEN` | State: SB1 still CONFIRMED, `cancelledAt=null` | P1 | regression |
| AUTHZ-010 | Authorization | Admin can read any booking | – | `GET /bookings/{SB1}` with `T(ADMIN)` | 200 | `id`=SB1, `userId`=G1 | P2 | regression |
| AUTHZ-011 | Authorization | includeInactive is ignored for guests and anonymous users | – | `GET /rooms?includeInactive=true` (a) with `T(G1)` (b) without a token | 200 | R302 not in the list (both) | P2 | regression |
| AUTHZ-012 | Authorization | Admin can list inactive rooms | – | `GET /rooms?includeInactive=true&limit=100` with `T(ADMIN)` | 200 | R302 in the list with `isActive=false` | P2 | regression |
| AUTHZ-013 | Authorization | New guest cannot see seeded bookings | `NEW_USER` registered and logged in | `GET /bookings` | 200 | `total=0`, `items=[]` | P2 | regression |

### 2.4 Request validation (VAL)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| VAL-001 | Validation | POST /bookings: each required field missing | `OWN_ROOM`, `T(G1)` | `BOOKING` with **one** of `roomId`, `checkIn`, `checkOut`, `guests`, `cardToken` removed | 400 `VALIDATION_ERROR` field = removed field | Message `<field> is required`. Parameterized (5 runs). State: the user's bookings total unchanged | P1 | regression |
| VAL-002 | Validation | POST /auth/register: each required field missing | – | `NEW_USER` with one of `email`, `password`, `fullName` removed | 400 `VALIDATION_ERROR` field = removed field | Parameterized (3 runs) | P2 | regression |
| VAL-003 | Validation | POST /auth/login: each required field missing | – | `{email, password}` with one removed | 400 `VALIDATION_ERROR` field = removed field | Parameterized (2 runs) | P2 | regression |
| VAL-004 | Validation | POST /rooms: each required field missing | `T(ADMIN)` | `NEW_ROOM` with one of `number`, `type`, `capacity`, `pricePerNight` removed | 400 `VALIDATION_ERROR` field = removed field | Parameterized (4 runs). State: number not created | P2 | regression |
| VAL-005 | Validation | POST /bookings: wrong types | `OWN_ROOM`, `T(G1)` | `BOOKING` with: `guests:"1"`, `guests:1.5`, `guests:true`, `roomId:123`, `checkIn:20261201`, `cardToken:null`, `checkOut:[]` | 400 `VALIDATION_ERROR` field = changed field | Parameterized. For `guests:"1"` message is `guests must be of type number`. State: the user's bookings total unchanged | P1 | regression |
| VAL-006 | Validation | POST /rooms: wrong types | `T(ADMIN)` | `NEW_ROOM` with: `capacity:"2"`, `capacity:2.5`, `pricePerNight:"100"`, `type:1`, `number:101`, `isActive:"false"` | 400 `VALIDATION_ERROR` field = changed field | Parameterized. State: number not created | P2 | regression |
| VAL-007 | Validation | Invalid checkIn date formats | `OWN_ROOM`, `T(G1)` | `BOOKING` with `checkIn` = each of: `2026/12/01`, `01-12-2026`, `2026-12-1`, `2026-13-01`, `2027-02-30`, `2026-12-01T00:00:00Z`, `""`, `tomorrow` | 400 `VALIDATION_ERROR` field `checkIn` | Parameterized | P1 | regression |
| VAL-008 | Validation | Invalid checkOut date format | `OWN_ROOM`, `T(G1)` | `BOOKING` with `checkOut: "2026-12-32"` | 400 `VALIDATION_ERROR` field `checkOut` | – | P2 | regression |
| VAL-009 | Validation | Unknown fields are rejected (mass assignment) | `OWN_ROOM`, `T(G1)` | `BOOKING` + one of: `"status":"CONFIRMED"`, `"totalPrice":1`, `"userId":G2.id`, `"paymentId":"x"` | 400 `VALIDATION_ERROR` field = extra field | Message `Unknown field: <field>`. Parameterized. State: the user's bookings total unchanged | P1 | regression |
| VAL-010 | Validation | Unknown field on room create | `T(ADMIN)` | `NEW_ROOM` + `"id": UNKNOWN_ID` | 400 `VALIDATION_ERROR` field `id` | State: number not created | P2 | regression |
| VAL-011 | Validation | Malformed JSON body | `T(G1)` | `POST /bookings` raw body `{"roomId": ` with `Content-Type: application/json` | 400 `INVALID_JSON` | State: the user's bookings total unchanged | P1 | regression |
| VAL-012 | Validation | Malformed JSON on login | – | `POST /auth/login` raw body `{email:` | 400 `INVALID_JSON` | – | P3 | regression |
| VAL-013 | Validation | Wrong Content-Type | `OWN_ROOM`, `T(G1)` | `POST /bookings`, body = valid `BOOKING` JSON text, `Content-Type: text/plain` | 415 `UNSUPPORTED_MEDIA_TYPE` | State: the user's bookings total unchanged | P1 | regression |
| VAL-014 | Validation | Form-encoded body is rejected | – | `POST /auth/register`, `Content-Type: application/x-www-form-urlencoded`, body `email=a@b.test&password=Secret123!&fullName=A` | 415 `UNSUPPORTED_MEDIA_TYPE` | State: login with that email → 401 | P2 | regression |
| VAL-015 | Validation | Body is JSON but not an object | `T(G1)` | `POST /bookings` body `[]`; also body `"text"` | 400 `VALIDATION_ERROR` / `INVALID_JSON` | `[]` → `VALIDATION_ERROR`, message `Request body must be a JSON object`; `"text"` → `INVALID_JSON` | P3 | regression |
| VAL-016 | Validation | Empty body | `T(G1)` | `POST /bookings` with no body | 400 `VALIDATION_ERROR` | `error.field` is one of the required fields | P3 | regression |
| VAL-017 | Validation | Pagination limit boundaries | – | `GET /rooms?limit=` 0 / 1 / 100 / 101 | 400 / 200 / 200 / 400 | 400s: field `limit`. 200s: `limit` echoed, `items.length ≤ limit`. Parameterized | P2 | regression |
| VAL-018 | Validation | Invalid page values | – | `GET /rooms?page=` 0 / -1 / abc / 1.5 | 400 `VALIDATION_ERROR` field `page` | Parameterized | P3 | regression |
| VAL-019 | Validation | Room capacity boundaries | `T(ADMIN)` | `POST /rooms` `NEW_ROOM` with capacity 0 / 1 / 6 / 7 | 400 / 201 / 201 / 400 | 400s: field `capacity`. Parameterized | P2 | regression |
| VAL-020 | Validation | Room price boundaries | `T(ADMIN)` | `POST /rooms` with `pricePerNight` 0 / -1 / 0.01 / 10.999 | 400 / 400 / 201 / 400 | 400s: field `pricePerNight` (10.999 → at most 2 decimals). Parameterized | P2 | regression |
| VAL-021 | Validation | Room number format | `T(ADMIN)` | `POST /rooms` with `number` `""` / `ABCDEFGHIJK` (11 chars) / `1 01` / `A1-B2` | 400 / 400 / 400 / 201 | 400s: field `number`. Parameterized | P3 | regression |
| VAL-022 | Validation | Room type must be a known value | `T(ADMIN)` | `POST /rooms` with `type: "TRIPLE"` | 400 `VALIDATION_ERROR` field `type` | Message lists `SINGLE, DOUBLE, SUITE` | P2 | regression |
| VAL-023 | Validation | Availability query validation | – | `GET /rooms/availability` with: no `checkIn`; no `checkOut`; `guests=0`; `guests=7`; `type=TRIPLE`; `checkIn=2026/12/01` | 400 `VALIDATION_ERROR` field = offending param | Parameterized | P2 | regression |

### 2.5 Rooms (ROOM)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| ROOM-001 | Rooms | Public room list shows only active rooms | – | `GET /rooms?limit=100` (no token) | 200 | Every item `isActive=true`; R101…R301 present; R302 absent | P1 | smoke |
| ROOM-002 | Rooms | Filter by type | – | `GET /rooms?type=SUITE&limit=100` | 200 | Every item `type=SUITE`; R301 present | P2 | regression |
| ROOM-003 | Rooms | Pagination | – | `GET /rooms?type=SINGLE&limit=1&page=1`, then `page=2` (SINGLE rooms are never created by tests, so the list is stable) | 200 | `page`/`limit` echoed; 1 item each; different ids; same `total` on both | P2 | regression |
| ROOM-004 | Rooms | Get room by id | – | `GET /rooms/{R101.id}` | 200 | `number=101`, `type=SINGLE`, `capacity=1`, `pricePerNight=80` | P1 | smoke |
| ROOM-005 | Rooms | Get unknown room | – | `GET /rooms/{UNKNOWN_ID}` | 404 `NOT_FOUND` | – | P2 | regression |
| ROOM-006 | Rooms | Get room with a non-UUID id | – | `GET /rooms/abc` | 404 `NOT_FOUND` | – | P3 | regression |
| ROOM-007 | Rooms | Inactive room is readable by id | – | `GET /rooms/{R302.id}` | 200 | `isActive=false` | P3 | regression |
| ROOM-008 | Rooms | Admin creates a room | `T(ADMIN)` | `POST /rooms` `NEW_ROOM` | 201 | `Location: /rooms/{id}`; body matches the request + `isActive=true`; `GET` on Location returns the same room | P1 | smoke |
| ROOM-009 | Rooms | Admin creates an inactive room | `T(ADMIN)` | `POST /rooms` `NEW_ROOM` + `"isActive": false` | 201 | `isActive=false`; not in public `GET /rooms` | P3 | regression |
| ROOM-010 | Rooms | Duplicate room number | `OWN_ROOM` | `POST /rooms` with `OWN_ROOM.number`, other fields different | 409 `ROOM_NUMBER_TAKEN` | State: `GET /rooms/{OWN_ROOM.id}` unchanged | P1 | regression |
| ROOM-011 | Rooms | Replace room (PUT) | `OWN_ROOM` | `PUT /rooms/{id}` `{number: <new unique>, type: SUITE, capacity: 4, pricePerNight: 199.99}` | 200 | Body has the new values; `GET` returns the new values; `isActive` unchanged | P1 | regression |
| ROOM-012 | Rooms | PUT rejects isActive | `OWN_ROOM` | `PUT /rooms/{id}` full body + `"isActive": false` | 400 `VALIDATION_ERROR` field `isActive` | State: room unchanged and still active | P2 | regression |
| ROOM-013 | Rooms | PUT with a partial body | `OWN_ROOM` | `PUT /rooms/{id}` `{"pricePerNight": 50}` | 400 `VALIDATION_ERROR` | State: price still 100 | P2 | regression |
| ROOM-014 | Rooms | PUT to a number that already exists | `OWN_ROOM` | `PUT /rooms/{id}` full body with `number: "101"` | 409 `ROOM_NUMBER_TAKEN` | State: number unchanged | P2 | regression |
| ROOM-015 | Rooms | PUT unknown room | `T(ADMIN)` | `PUT /rooms/{UNKNOWN_ID}` valid full body | 404 `NOT_FOUND` | State: number not created | P2 | regression |
| ROOM-016 | Rooms | PATCH a single field | `OWN_ROOM` | `PATCH /rooms/{id}` `{"pricePerNight": 150}` | 200 | `pricePerNight=150`; number/type/capacity/isActive unchanged | P1 | regression |
| ROOM-017 | Rooms | PATCH with an empty body | `OWN_ROOM` | `PATCH /rooms/{id}` `{}` | 400 `VALIDATION_ERROR` | State: room unchanged | P2 | regression |
| ROOM-018 | Rooms | PATCH unknown room | `T(ADMIN)` | `PATCH /rooms/{UNKNOWN_ID}` `{"pricePerNight": 150}` | 404 `NOT_FOUND` | – | P3 | regression |
| ROOM-019 | Rooms | PATCH to a number that already exists | `OWN_ROOM` | `PATCH /rooms/{id}` `{"number": "101"}` | 409 `ROOM_NUMBER_TAKEN` | State: number unchanged | P3 | regression |
| ROOM-020 | Rooms | Deactivate a room without bookings | `OWN_ROOM` | `PATCH /rooms/{id}` `{"isActive": false}` | 200 | `isActive=false`; absent from `GET /rooms` and from availability for any dates | P1 | regression |
| ROOM-021 | Rooms | Cannot deactivate a room with future confirmed bookings | – | `PATCH /rooms/{R301.id}` `{"isActive": false}` (SB5 is CONFIRMED) | 409 `ROOM_HAS_FUTURE_BOOKINGS` | State: R301 still active | P1 | regression |
| ROOM-022 | Rooms | Cancelled / failed bookings do not prevent deactivation | `OWN_ROOM`; G1 books it with `tok_decline` (→ PAYMENT_FAILED) and books other dates then cancels | `PATCH /rooms/{id}` `{"isActive": false}` | 200 | `isActive=false` | P2 | regression |
| ROOM-023 | Rooms | Past confirmed bookings do not prevent deactivation | `OWN_ROOM`; G1 books D+5 → D+7 (CONFIRMED) | `PATCH /rooms/{id}` `{"isActive": false}` with `X-Test-Now` = D+8 at 12:00Z | 200 | `isActive=false` | P3 | regression |
| ROOM-024 | Rooms | Ongoing stay prevents deactivation | `OWN_ROOM`; G1 books D+5 → D+7 | `PATCH /rooms/{id}` `{"isActive": false}` with `X-Test-Now` = D+6 at 12:00Z | 409 `ROOM_HAS_FUTURE_BOOKINGS` | State: still active | P3 | regression |
| ROOM-025 | Rooms | Reactivate a room | `OWN_ROOM` deactivated | `PATCH /rooms/{id}` `{"isActive": true}` | 200 | `isActive=true`; visible again in `GET /rooms` | P3 | regression |

### 2.6 Availability and overlap (AVAIL)

Unless stated otherwise: `OWN_ROOM` has one CONFIRMED booking **E** = D+20 → D+25 (made by G1).

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| AVAIL-001 | Availability | Search returns free rooms with stay price | – | `GET /rooms/availability?checkIn=D+100&checkOut=D+103&limit=100` | 200 | Every item `isActive=true`, `nights=3`, `totalPrice>0`; R302 absent | P1 | smoke |
| AVAIL-002 | Availability | Booked room is not returned for overlapping dates | E | `GET /rooms/availability?checkIn=D+21&checkOut=D+23&limit=100` | 200 | `OWN_ROOM` absent | P1 | regression |
| AVAIL-003 | Availability | Room free from the checkout day (back-to-back) | E | Search `checkIn=D+25&checkOut=D+27` | 200 | `OWN_ROOM` present | P1 | regression |
| AVAIL-004 | Availability | Room free until the check-in day | E | Search `checkIn=D+18&checkOut=D+20` | 200 | `OWN_ROOM` present | P2 | regression |
| AVAIL-005 | Availability | Guests filter excludes small rooms | `OWN_ROOM` (capacity 2) | Search D+100 → D+101 with `guests=3`, then `guests=2` | 200 | `guests=3`: `OWN_ROOM` absent, every item `capacity≥3`; `guests=2`: present | P2 | regression |
| AVAIL-006 | Availability | Type filter | – | Search D+100 → D+101 `type=SINGLE` | 200 | Every item `type=SINGLE` | P3 | regression |
| AVAIL-007 | Availability | Inactive rooms are never returned | – | Search D+100 → D+101 `limit=100` | 200 | R302 absent | P1 | regression |
| AVAIL-008 | Availability | Seeded statuses: blocking vs non-blocking | – | Search (a) D+40 → D+42 (b) D+20 → D+22 (c) D+5 → D+7, `limit=100` | 200 | (a) R102 **absent** (SB3 PENDING_PAYMENT blocks); (b) R202 **present** (SB2 CANCELLED); (c) R101 **present** (SB4 PAYMENT_FAILED) | P2 | regression |
| AVAIL-009 | Availability | Date rules apply to search | – | Search with: checkIn D-1; checkIn=checkOut=D+10; D+10 → D+41 (31 nights); checkIn D+366 | 400 `VALIDATION_ERROR` | Parameterized; fields `checkIn`/`checkOut`/`checkOut`/`checkIn` | P2 | regression |
| AVAIL-010 | Availability | Overlap: identical dates | E | G2 `POST /bookings` `BOOKING` D+20 → D+25 | 409 `ROOM_UNAVAILABLE` | State: the user's bookings total unchanged; E still CONFIRMED | P1 | regression |
| AVAIL-011 | Availability | Overlap: partial at the start | E | G2 books D+18 → D+21 | 409 `ROOM_UNAVAILABLE` | State: the user's bookings total unchanged | P1 | regression |
| AVAIL-012 | Availability | Overlap: partial at the end | E | G2 books D+24 → D+27 | 409 `ROOM_UNAVAILABLE` | State: the user's bookings total unchanged | P1 | regression |
| AVAIL-013 | Availability | Overlap: new stay inside the existing one | E | G2 books D+21 → D+23 | 409 `ROOM_UNAVAILABLE` | State: the user's bookings total unchanged | P1 | regression |
| AVAIL-014 | Availability | Overlap: new stay encloses the existing one | E | G2 books D+19 → D+26 | 409 `ROOM_UNAVAILABLE` | State: the user's bookings total unchanged | P2 | regression |
| AVAIL-015 | Availability | Back-to-back after: check-in on the checkout day | E | G2 books D+25 → D+27 | 201 | status CONFIRMED | P1 | regression |
| AVAIL-016 | Availability | Back-to-back before: checkout on the check-in day | E | G2 books D+18 → D+20 | 201 | status CONFIRMED | P1 | regression |
| AVAIL-017 | Availability | Cancelled booking frees the room | E | G1 `POST /bookings/{E}/cancel`; then G2 books D+20 → D+25 | 200, then 201 | Second booking CONFIRMED | P1 | regression |
| AVAIL-018 | Availability | Failed payment does not block the room | `OWN_ROOM`, no bookings | G1 books D+20 → D+25 with `tok_decline` (402); then G2 books the same dates with `tok_success` | 402, then 201 | First booking PAYMENT_FAILED, second CONFIRMED | P1 | regression |
| AVAIL-019 | Availability | Pending payment blocks the room | – | G2 `POST /bookings` R102, D+40 → D+42, guests 1 | 409 `ROOM_UNAVAILABLE` | SB3 is PENDING_PAYMENT. State: the user's bookings total unchanged | P2 | regression |
| AVAIL-020 | Availability | Same dates in a different room are fine | E; second own room `OWN_ROOM2` | G2 books `OWN_ROOM2` D+20 → D+25 | 201 | – | P3 | regression |

### 2.7 Booking creation and boundaries (BOOK)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| BOOK-001 | Bookings | Create a booking | `OWN_ROOM`, `T(G1)` | `POST /bookings` `BOOKING` | 201 | `Location: /bookings/{id}`; `status=CONFIRMED`, `paymentId` not null, `userId=G1.id`, dates/guests as sent, `totalPrice>0`, `cancelledAt=null`; `GET` on Location returns the same booking | P1 | smoke |
| BOOK-002 | Bookings | Owner reads own booking | BOOK-001-style booking B by G1 | `GET /bookings/{B}` with `T(G1)` | 200 | Same values as at creation | P1 | smoke |
| BOOK-003 | Bookings | New booking appears in own list | booking B by G1 | `GET /bookings?limit=100` with `T(G1)` | 200 | B present | P2 | regression |
| BOOK-004 | Bookings | checkIn in the past | `OWN_ROOM` | `BOOKING` checkIn D-1, checkOut D+1 | 400 `VALIDATION_ERROR` field `checkIn` | Message `checkIn cannot be in the past`. State: the user's bookings total unchanged | P1 | regression |
| BOOK-005 | Bookings | checkIn today is allowed | `OWN_ROOM` | `BOOKING` checkIn D+0, checkOut D+1 | 201 | – | P2 | regression |
| BOOK-006 | Bookings | "Today" follows UTC, to the second | `OWN_ROOM`; let X = D+50 | `BOOKING` checkIn X, checkOut X+1, with (a) `X-Test-Now: X 23:59:59Z` (b) `X-Test-Now: X+1 00:00:00Z` | (a) 201 (b) 400 | (b) field `checkIn`. Use different own rooms for (a) and (b) | P3 | regression |
| BOOK-007 | Bookings | Same-day checkout | `OWN_ROOM` | `BOOKING` checkIn D+30, checkOut D+30 | 400 `VALIDATION_ERROR` field `checkOut` | Message `checkOut must be after checkIn`. State: unchanged | P1 | regression |
| BOOK-008 | Bookings | checkOut before checkIn | `OWN_ROOM` | `BOOKING` checkIn D+30, checkOut D+29 | 400 `VALIDATION_ERROR` field `checkOut` | State: unchanged | P1 | regression |
| BOOK-009 | Bookings | 30 nights is allowed | `OWN_ROOM` | `BOOKING` D+30 → D+60 | 201 | 30 nights; `totalPrice` per the pricing rule | P1 | regression |
| BOOK-010 | Bookings | 31 nights is rejected | `OWN_ROOM` | `BOOKING` D+30 → D+61 | 400 `VALIDATION_ERROR` field `checkOut` | Message `Maximum stay is 30 nights`. State: unchanged | P1 | regression |
| BOOK-011 | Bookings | checkIn 365 days ahead is allowed | `OWN_ROOM` | `BOOKING` D+365 → D+366 | 201 | – | P1 | regression |
| BOOK-012 | Bookings | checkIn 366 days ahead is rejected | `OWN_ROOM` | `BOOKING` D+366 → D+367 | 400 `VALIDATION_ERROR` field `checkIn` | State: unchanged | P1 | regression |
| BOOK-013 | Bookings | guests = 0 | `OWN_ROOM` | `BOOKING` guests 0 | 400 `VALIDATION_ERROR` field `guests` | State: unchanged | P1 | regression |
| BOOK-014 | Bookings | guests = room capacity | `OWN_ROOM` (capacity 2) | `BOOKING` guests 2 | 201 | `guests=2` | P1 | regression |
| BOOK-015 | Bookings | guests = capacity + 1 | `OWN_ROOM` (capacity 2) | `BOOKING` guests 3 | 400 `VALIDATION_ERROR` field `guests` | State: unchanged | P1 | regression |
| BOOK-016 | Bookings | Negative guests | `OWN_ROOM` | `BOOKING` guests -1 | 400 `VALIDATION_ERROR` field `guests` | – | P3 | regression |
| BOOK-017 | Bookings | Unknown room | – | `BOOKING` roomId `UNKNOWN_ID` | 404 `NOT_FOUND` | State: the user's bookings total unchanged | P2 | regression |
| BOOK-018 | Bookings | roomId is not a UUID | – | `BOOKING` roomId `"abc"` | 400 `VALIDATION_ERROR` field `roomId` | – | P3 | regression |
| BOOK-019 | Bookings | Inactive room cannot be booked | – | `BOOKING` roomId R302, guests 1 | 409 `ROOM_INACTIVE` | State: the user's bookings total unchanged | P1 | regression |
| BOOK-020 | Bookings | Get unknown booking | – | `GET /bookings/{UNKNOWN_ID}` with `T(G1)` | 404 `NOT_FOUND` | – | P2 | regression |
| BOOK-021 | Bookings | Get booking with a non-UUID id | – | `GET /bookings/abc` with `T(G1)` | 404 `NOT_FOUND` | – | P3 | regression |
| BOOK-022 | Bookings | Booking list pagination | `NEW_USER` with 3 own bookings | `GET /bookings?limit=2&page=1` and `page=2` | 200 | `total=3`; page 1 has 2 items, page 2 has 1; no duplicates | P3 | regression |

### 2.8 Pricing (PRICE)

`OWN_ROOM` price is 100.00 unless stated. `MON` is a Monday, so `MON+4` is a Friday.

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| PRICE-001 | Pricing | Weekday-only stay | `OWN_ROOM` | `BOOKING` MON → MON+3 (Mon, Tue, Wed nights) | 201 | `totalPrice=300.00` | P1 | regression |
| PRICE-002 | Pricing | Stay including Friday and Saturday | `OWN_ROOM` | `BOOKING` MON+3 → MON+6 (Thu, Fri, Sat nights) | 201 | `totalPrice=340.00` (100 + 120 + 120) | P1 | regression |
| PRICE-003 | Pricing | Friday night only | `OWN_ROOM` | `BOOKING` MON+4 → MON+5 | 201 | `totalPrice=120.00` | P2 | regression |
| PRICE-004 | Pricing | Sunday night is not weekend | `OWN_ROOM` | `BOOKING` MON+6 → MON+7 | 201 | `totalPrice=100.00` | P2 | regression |
| PRICE-005 | Pricing | Full week | `OWN_ROOM` | `BOOKING` MON → MON+7 | 201 | `totalPrice=740.00` (5×100 + 2×120) | P2 | regression |
| PRICE-006 | Pricing | Rounding down | `OWN_ROOM` with price 33.33 | `BOOKING` MON+4 → MON+6 | 201 | `totalPrice=79.99` (2 × 39.996 = 79.992) | P1 | regression |
| PRICE-007 | Pricing | Rounding up | `OWN_ROOM` with price 33.34 | `BOOKING` MON+4 → MON+6 | 201 | `totalPrice=80.02` (2 × 40.008 = 80.016) | P2 | regression |
| PRICE-008 | Pricing | Availability price equals booking price | `OWN_ROOM` | Search MON+2 → MON+6; then book the same stay | 200, 201 | Search item `totalPrice` = booking `totalPrice` = 440.00 | P2 | regression |
| PRICE-009 | Pricing | Price change does not affect existing bookings | Booking B on `OWN_ROOM` (MON → MON+3, 300.00) | `PATCH /rooms/{id}` `{"pricePerNight": 500}`; `GET /bookings/{B}` | 200, 200 | B `totalPrice` still 300.00 | P2 | regression |

### 2.9 Payment integration (PAY)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| PAY-001 | Payment | Approved payment confirms the booking | `OWN_ROOM` | `BOOKING` `cardToken: tok_success`; `GET /bookings/{id}`; `GET {PAY}/payments/{paymentId}` | 201, 200, 200 | Booking CONFIRMED with `paymentId`; payment `status=APPROVED`, `amount` = `totalPrice`, `bookingId` = booking id | P1 | smoke |
| PAY-002 | Payment | Declined payment | `OWN_ROOM` | `BOOKING` `cardToken: tok_decline`; `GET /bookings/{error.details.bookingId}`; `GET {PAY}/payments/{paymentId}` | 402 `PAYMENT_DECLINED`, 200, 200 | `error.details.bookingId` present; booking `PAYMENT_FAILED` with `paymentId`; payment `status=DECLINED` | P1 | smoke |
| PAY-003 | Payment | Payment timeout | `OWN_ROOM` | `BOOKING` `cardToken: tok_slow`; `GET /bookings/{error.details.bookingId}` | 504 `PAYMENT_TIMEOUT`, 200 | Response arrives after ≥ 2.9 s and < 4.5 s (3 s timeout, not 5 s); booking `PAYMENT_FAILED`, `paymentId=null` | P1 | regression |
| PAY-004 | Payment | Payment service error | `OWN_ROOM` | `BOOKING` `cardToken: tok_error`; `GET /bookings/{error.details.bookingId}` | 502 `PAYMENT_SERVICE_ERROR`, 200 | Booking `PAYMENT_FAILED`, `paymentId=null` | P1 | regression |
| PAY-005 | Payment | Unknown card token | `OWN_ROOM` | `BOOKING` `cardToken: tok_unknown` | 400 `VALIDATION_ERROR` field `cardToken` | State: the user's bookings total unchanged; `OWN_ROOM` still bookable for the same dates (201 with `tok_success`) | P1 | regression |
| PAY-006 | Payment | Empty card token | `OWN_ROOM` | `BOOKING` `cardToken: ""` | 400 `VALIDATION_ERROR` field `cardToken` | State: unchanged | P3 | regression |
| PAY-007 | Payment | payment-service down | `docker compose stop payment-service` | `BOOKING` `tok_success`; then `GET /health`; restart payment-service | 502 `PAYMENT_SERVICE_ERROR` | Booking `PAYMENT_FAILED`; booking-api `/health` still 200. **Manual**: needs the container stopped | P2 | manual |

### 2.10 payment-service API (PSVC)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| PSVC-001 | Payment service | Approve a payment | – | `POST {PAY}/payments` `{bookingId: "<uuid>", amount: 123.45, cardToken: "tok_success"}` | 201 | `Location: /payments/{id}`; `status=APPROVED`, `amount=123.45` | P2 | regression |
| PSVC-002 | Payment service | Decline a payment | – | Same with `tok_decline` | 402 `PAYMENT_DECLINED` | `error.details.payment.status=DECLINED`; `GET {PAY}/payments/{that id}` → 200 DECLINED | P2 | regression |
| PSVC-003 | Payment service | Simulated provider failure | – | Same with `tok_error` | 500 `INTERNAL_ERROR` | Error format, no stack trace | P3 | regression |
| PSVC-004 | Payment service | Unknown card token | – | Same with `tok_foo` | 400 `INVALID_CARD_TOKEN` field `cardToken` | – | P3 | regression |
| PSVC-005 | Payment service | Slow token answers after 5 s | – | Same with `tok_slow` | 201 | Response time ≥ 5 s (`PAYMENT_SLOW_MS`) | P3 | regression |
| PSVC-006 | Payment service | Request validation | – | Body missing `amount`; `amount: -1`; extra field `foo` | 400 `VALIDATION_ERROR` | Parameterized; `error.field` = `amount` / `amount` / `foo` | P3 | regression |
| PSVC-007 | Payment service | Get unknown payment | – | `GET {PAY}/payments/{UNKNOWN_ID}` | 404 `NOT_FOUND` | – | P3 | regression |

### 2.11 Cancellation (CANC)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| CANC-001 | Cancellation | Owner cancels more than 48 h ahead | Booking B by G1 on `OWN_ROOM`, D+30 → D+32 | `POST /bookings/{B}/cancel` with `T(G1)`; `GET /bookings/{B}` | 200, 200 | `status=CANCELLED`, `cancelledAt` set (both responses) | P1 | smoke |
| CANC-002 | Cancellation | Cancel an already cancelled booking | B cancelled (CANC-001 steps) | `POST /bookings/{B}/cancel` again | 409 `ALREADY_CANCELLED` | State: `cancelledAt` unchanged | P1 | regression |
| CANC-003 | Cancellation | Seeded cancelled booking cannot be cancelled again | – | `POST /bookings/{SB2}/cancel` with `T(G1)` | 409 `ALREADY_CANCELLED` | – | P3 | regression |
| CANC-004 | Cancellation | Guest cancels inside 48 h | – | `POST /bookings/{SB6}/cancel` with `T(G2)` (check-in tomorrow) | 422 `CANCELLATION_WINDOW_PASSED` | Clear message mentioning 48 hours. State: SB6 still CONFIRMED | P1 | regression |
| CANC-005 | Cancellation | 48 h boundary: exactly 48 h is too late | Booking B by G1 on `OWN_ROOM`, D+30 → D+32 | Cancel with `X-Test-Now` = `CHECKIN(B) − 48h` | 422 `CANCELLATION_WINDOW_PASSED` | State: B still CONFIRMED | P1 | regression |
| CANC-006 | Cancellation | 48 h boundary: 48 h + 1 s is allowed | as CANC-005 | Cancel with `X-Test-Now` = `CHECKIN(B) − 48h − 1s` | 200 | `status=CANCELLED` | P1 | regression |
| CANC-007 | Cancellation | 48 h boundary: 47 h 59 m 59 s is too late | as CANC-005 | Cancel with `X-Test-Now` = `CHECKIN(B) − 48h + 1s` | 422 `CANCELLATION_WINDOW_PASSED` | State: B still CONFIRMED | P2 | regression |
| CANC-008 | Cancellation | Admin cancels inside 48 h | Booking B by G1 on `OWN_ROOM`, D+1 → D+2 | `POST /bookings/{B}/cancel` with `T(ADMIN)` | 200 | `status=CANCELLED` | P1 | regression |
| CANC-009 | Cancellation | Admin cancels another user's booking | Booking B by G2 on `OWN_ROOM`, D+30 → D+32 | `POST /bookings/{B}/cancel` with `T(ADMIN)` | 200 | `status=CANCELLED`; `userId` still G2 | P2 | regression |
| CANC-010 | Cancellation | Guest cannot cancel after check-in | Booking B by G1 on `OWN_ROOM`, D+30 → D+32 | Cancel with `X-Test-Now` = `CHECKIN(B) + 1h` | 422 `CANCELLATION_WINDOW_PASSED` | State: still CONFIRMED | P3 | regression |
| CANC-011 | Cancellation | Failed-payment booking cannot be cancelled | – | `POST /bookings/{SB4}/cancel` with `T(G2)` | 409 `BOOKING_NOT_CANCELLABLE` | State: SB4 still PAYMENT_FAILED | P2 | regression |
| CANC-012 | Cancellation | Cancel an unknown booking | – | `POST /bookings/{UNKNOWN_ID}/cancel` with `T(G1)` | 404 `NOT_FOUND` | – | P2 | regression |

### 2.12 Concurrency (CONC)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| CONC-001 | Concurrency | Parallel identical bookings: exactly one wins | `OWN_ROOM` | Send 10 `POST /bookings` (same room, D+40 → D+42) **at the same time** (G1 and G2 alternating) | exactly one 201, nine 409 | Every 409 is `ROOM_UNAVAILABLE`. State: admin `GET /bookings` shows exactly one CONFIRMED booking for `OWN_ROOM` | P1 | regression |
| CONC-002 | Concurrency | Parallel overlapping (not identical) stays | `OWN_ROOM` | In parallel: D+40 → D+43 and D+42 → D+45 | one 201, one 409 | – | P2 | regression |
| CONC-003 | Concurrency | Parallel non-overlapping stays both succeed | `OWN_ROOM` | In parallel: D+40 → D+42 and D+42 → D+44 | 201, 201 | Back-to-back still allowed under load | P2 | regression |
| CONC-004 | Concurrency | Parallel cancel of the same booking | Booking B by G1 on `OWN_ROOM` | Two `POST /bookings/{B}/cancel` at the same time | one 200, one 409 | 409 is `ALREADY_CANCELLED` | P3 | regression |
| CONC-005 | Concurrency | Parallel register with the same email | – | Two `POST /auth/register` with the same `NEW_USER` at the same time | one 201, one 409 | 409 is `EMAIL_TAKEN` | P3 | regression |

### 2.13 Response validation (RESP)

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| RESP-001 | Response | JSON Content-Type on success and error | – | `GET /rooms`; `GET /rooms/{UNKNOWN_ID}`; `POST /auth/login` `{}` | 200, 404, 400 | Every `Content-Type` starts with `application/json` | P2 | regression |
| RESP-002 | Response | Error format is consistent across status codes | – | One request each producing 400, 401, 403, 404, 409, 415, 422 (reuse the steps of VAL-001, AUTH-015, AUTHZ-008, ROOM-005, ROOM-021, VAL-013, CANC-004) | as listed | Each body matches `error.schema.json`; `code` is UPPER_SNAKE_CASE; `message` non-empty | P1 | regression |
| RESP-003 | Response | Unknown route returns JSON 404 | – | `GET /does-not-exist`; `DELETE /rooms/{R101.id}` | 404 `NOT_FOUND` | JSON error body, not HTML | P2 | regression |
| RESP-004 | Response | No sensitive data in responses | – | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /bookings` (admin) | 201/200 | No body contains `password`, `passwordHash` or `$2` (bcrypt prefix); schemas forbid extra fields | P1 | regression |
| RESP-005 | Response | No framework or version headers | – | `GET /health`; `GET /does-not-exist` | 200, 404 | No `X-Powered-By` header; `Server` header absent or without a framework/version | P2 | regression |
| RESP-006 | Response | No stack trace in errors | – | `POST /bookings` malformed JSON (VAL-011) | 400 | Body has no `stack`, `at ` file paths or `node_modules` | P2 | regression |
| RESP-007 | Response | Response time under 500 ms | `OWN_ROOM` | Measure: `GET /rooms`, `GET /rooms/availability` (D+100 → D+103), `POST /auth/login`, `POST /bookings` (`tok_success`), `GET /bookings` | 200/201 | Each < 500 ms | P2 | regression |
| RESP-008 | Response | Payload too large | `T(G1)` | `POST /bookings` with a JSON body > 100 kB (e.g. a 200 kB `cardToken` string) | 413 `PAYLOAD_TOO_LARGE` | JSON error body. State: unchanged | P3 | regression |
| RESP-009 | Response | Location header on every 201 | `T(ADMIN)`, `OWN_ROOM` | `POST /rooms` `NEW_ROOM`; `POST /bookings` `BOOKING` | 201, 201 | `Location` = `/rooms/{id}` / `/bookings/{id}` matching body `id`; GET on it returns 200 | P1 | regression |

### 2.14 Price quote (QUOTE)

`GET /rooms/{id}/quote?checkIn&checkOut` was added in Phase 4 for the room page's price breakdown.
It is public and read-only. It prices a stay; it does **not** check availability.

| ID | Category | Title | Preconditions | Steps | Expected status | Expected result | Priority | Tag |
|---|---|---|---|---|---|---|---|---|
| QUOTE-001 | Quote | Quote lists the price of each night | `OWN_ROOM` (100.00) | `GET /rooms/{id}/quote?checkIn=MON+3&checkOut=MON+6` (Thu, Fri, Sat nights), no token | 200 | `roomId`, dates echoed; `pricePerNight=100`; `nights` = [MON+3 / weekday / 100, MON+4 / weekend / 120, MON+5 / weekend / 120]; `totalPrice=340` | P2 | regression |
| QUOTE-002 | Quote | Nightly prices are unrounded; only the total is rounded, and it matches the booking | `OWN_ROOM` with price 33.33 | Quote MON+4 → MON+6; then `POST /bookings` the same stay | 200, 201 | Each night `price=39.996`; quote `totalPrice=79.99` = booking `totalPrice` | P2 | regression |
| QUOTE-003 | Quote | Date rules apply to quotes | `OWN_ROOM` | Quote with: checkIn D-1; checkIn = checkOut; 31 nights; checkIn D+366; `checkIn=2026/12/01`; no `checkOut` | 400 `VALIDATION_ERROR` | Parameterized; `error.field` = `checkIn` / `checkOut` / `checkOut` / `checkIn` / `checkIn` / `checkOut` | P2 | regression |
| QUOTE-004 | Quote | Quote for an unknown room | – | `GET /rooms/{UNKNOWN_ID}/quote?…` and `GET /rooms/abc/quote?…` (valid dates) | 404 `NOT_FOUND` | – | P3 | regression |
| QUOTE-005 | Quote | Quote for an inactive room | – | `GET /rooms/{R302.id}/quote?checkIn=D+100&checkOut=D+101` | 409 `ROOM_INACTIVE` | – | P3 | regression |
| QUOTE-006 | Quote | A quote is not an availability check | `OWN_ROOM` with CONFIRMED booking D+20 → D+25 | Quote D+20 → D+25 | 200 | Quote returned (5 nights); booking the same stay still gives 409 `ROOM_UNAVAILABLE` | P3 | regression |

---

## 3. Coverage of PROJECT_PLAN.md

| Plan requirement | Covered by |
|---|---|
| Auth: valid login, wrong password, unknown user, missing fields, no token, malformed header, invalid/expired/tampered token | AUTH-009…AUTH-023, VAL-003 |
| Authorization: guest vs admin on every protected endpoint; other guest's booking | AUTHZ-001…AUTHZ-013, AUTH-023 |
| Validation: missing fields, wrong types, date formats, unknown fields, malformed JSON, wrong Content-Type | VAL-001…VAL-023 |
| Boundaries: same-day, 30/31 nights, 365/366 days, guests 0/cap/cap+1, 48h | BOOK-004…BOOK-016, CANC-005…CANC-007, VAL-017…VAL-021, AUTH-007 |
| Availability: full/partial start/partial end/inside overlap, back-to-back, cancelled frees room | AVAIL-001…AVAIL-020 |
| Pricing: weekday, Fri+Sat, rounding | PRICE-001…PRICE-009 |
| Payment: five tokens, follow-up GET | PAY-001…PAY-007, PSVC-001…PSVC-007 |
| Concurrency | CONC-001…CONC-005 |
| Response validation: schema, headers, Location, error format, no sensitive data, < 500 ms | RESP-001…RESP-009, rule 1.2.3 |
| Room details price breakdown (Phase 4 endpoint) | QUOTE-001…QUOTE-006 |
| State verification after failed writes | rule 1.2.5, "State:" in each failing-write row |
| Business rules 1–16 | 1–4: BOOK, VAL-007 · 5–8: AVAIL, CONC · 9: BOOK-013…015 · 10: PRICE · 11: AVAIL-007, BOOK-019 · 12: AUTHZ-009, CANC-009 · 13: CANC-004…010 · 14: CANC-002 · 15: AUTHZ-001…004 · 16: ROOM-021…024 |

### Out of scope for the API suites

- `/test/reset` and `/test/seed` (infrastructure, used in setup) and their 404 outside `APP_ENV=test`
  (the suites run against `APP_ENV=test`).
- UI behaviour (Phase 5), contracts (v2), load and security scanning (v3).
