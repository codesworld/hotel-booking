package com.hotelbooking.api.tests;

import com.hotelbooking.api.BaseTest;
import com.hotelbooking.api.config.Config;
import com.hotelbooking.api.core.Jwt;
import com.hotelbooking.api.model.LoginResponse;
import com.hotelbooking.api.model.RegisterRequest;
import com.hotelbooking.api.model.RoomRequest;
import com.hotelbooking.api.model.User;
import io.qameta.allure.Epic;
import io.qameta.allure.Feature;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.Map;
import java.util.UUID;
import java.util.function.UnaryOperator;
import java.util.stream.Stream;

import static com.hotelbooking.api.core.ApiAssertions.assertError;
import static com.hotelbooking.api.core.ApiAssertions.assertOk;
import static org.assertj.core.api.Assertions.assertThat;

@Epic("API")
@Feature("Authentication")
class AuthTest extends BaseTest {

    @Test
    @Tag("smoke")
    @DisplayName("AUTH-001 Register a new guest")
    void registerNewGuest() {
        RegisterRequest user = RegisterRequest.newUser();
        Response response = auth.register(user);
        assertOk(response, 201, "user");
        User created = response.as(User.class);
        assertThat(created.role()).isEqualTo("GUEST");
        assertThat(created.email()).isEqualTo(user.email());
        assertThat(response.asString()).doesNotContainIgnoringCase("password");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-002 Register stores the email in lowercase")
    void registerLowercasesEmail() {
        String email = "Mixed." + UUID.randomUUID().toString().substring(0, 8) + "@Example.TEST";
        Response response = auth.register(RegisterRequest.newUser().withEmail(email));
        assertOk(response, 201, "user");
        assertThat(response.jsonPath().getString("email")).isEqualTo(email.toLowerCase());
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-003 Register with an existing email")
    void registerDuplicateEmail() {
        var user = data.freshUser();
        Response response = auth.register(RegisterRequest.newUser().withEmail(user.email()).withPassword("Another123!"));
        assertError(response, 409, "EMAIL_TAKEN");
        // State: the original account and password are untouched
        assertOk(auth.login(user.email(), user.password()), 200, "login-response");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-004 Register duplicate email with different case")
    void registerDuplicateEmailDifferentCase() {
        var user = data.freshUser();
        assertError(auth.register(RegisterRequest.newUser().withEmail(user.email().toUpperCase())), 409, "EMAIL_TAKEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-005 Register cannot set role (mass assignment)")
    void registerCannotSetRole() {
        RegisterRequest user = RegisterRequest.newUser();
        Map<String, Object> body = com.hotelbooking.api.core.Json.toMap(user);
        body.put("role", "ADMIN");

        Response response = auth.register(body);
        assertError(response, 400, "VALIDATION_ERROR", "role");
        assertThat(response.jsonPath().getString("error.message")).isEqualTo("Unknown field: role");
        // State: no user was created
        assertError(auth.login(user.email(), user.password()), 401, "INVALID_CREDENTIALS");
    }

    @ParameterizedTest(name = PARAMS)
    @Tag("regression")
    @DisplayName("AUTH-006 Register with invalid email format")
    @ValueSource(strings = {"plainaddress", "a@", "@b.test", "a b@c.test"})
    void registerInvalidEmail(String email) {
        assertError(auth.register(RegisterRequest.newUser().withEmail(email)), 400, "VALIDATION_ERROR", "email");
    }

    @ParameterizedTest(name = "{displayName} [{0} chars → {1}]")
    @Tag("regression")
    @DisplayName("AUTH-007 Password length boundaries")
    @CsvSource({"7, 400", "8, 201", "72, 201", "73, 400"})
    void passwordLengthBoundaries(int length, int status) {
        Response response = auth.register(RegisterRequest.newUser().withPassword("p".repeat(length)));
        if (status == 201) assertOk(response, 201, "user");
        else assertError(response, 400, "VALIDATION_ERROR", "password");
    }

    @ParameterizedTest(name = "{displayName} [\"{0}\"]")
    @Tag("regression")
    @DisplayName("AUTH-008 Register with an empty or whitespace-only full name")
    @ValueSource(strings = {"", "   "})
    void registerBlankFullName(String fullName) {
        assertError(auth.register(RegisterRequest.newUser().withFullName(fullName)), 400, "VALIDATION_ERROR", "fullName");
    }

    @Test
    @Tag("smoke")
    @DisplayName("AUTH-009 Valid login")
    void validLogin() {
        Response response = auth.login(Config.guest1());
        assertOk(response, 200, "login-response");
        LoginResponse login = response.as(LoginResponse.class);
        assertThat(login.tokenType()).isEqualTo("Bearer");
        assertThat(login.expiresIn()).isEqualTo(900);
        assertThat(login.user().email()).isEqualTo(Config.guest1().email());
        assertThat(login.user().id()).isEqualTo(seed.g1().id());
        assertThat(login.user().role()).isEqualTo("GUEST");
    }

    @Test
    @Tag("smoke")
    @DisplayName("AUTH-010 Login with wrong password")
    void loginWrongPassword() {
        Response response = auth.login(Config.guest1().email(), "WrongPass1!");
        assertError(response, 401, "INVALID_CREDENTIALS");
        assertThat(response.jsonPath().getString("error.message")).isEqualTo("Invalid email or password");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-011 Login with unknown email gives the same message")
    void loginUnknownEmailSameMessage() {
        Response wrongPassword = auth.login(Config.guest1().email(), "WrongPass1!");
        Response unknownUser = auth.login(RegisterRequest.uniqueEmail(), "WrongPass1!");
        assertError(unknownUser, 401, "INVALID_CREDENTIALS");
        assertThat(unknownUser.asString()).isEqualTo(wrongPassword.asString());
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-012 Login email is case-insensitive")
    void loginEmailCaseInsensitive() {
        Response response = auth.login(Config.guest1().email().toUpperCase(), Config.guest1().password());
        assertOk(response, 200, "login-response");
        assertThat(response.jsonPath().getString("user.email")).isEqualTo(Config.guest1().email());
    }

    @Test
    @Tag("smoke")
    @DisplayName("AUTH-013 Admin login returns ADMIN role")
    void adminLogin() {
        Response response = auth.login(Config.admin());
        assertOk(response, 200, "login-response");
        assertThat(response.jsonPath().getString("user.role")).isEqualTo("ADMIN");
    }

    @Test
    @Tag("smoke")
    @DisplayName("AUTH-014 /auth/me with valid token")
    void meWithValidToken() {
        Response response = auth.me(tokens.g1());
        assertOk(response, 200, "user");
        User me = response.as(User.class);
        assertThat(me.id()).isEqualTo(seed.g1().id());
        assertThat(me.email()).isEqualTo(Config.guest1().email());
        assertThat(me.role()).isEqualTo("GUEST");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-015 /auth/me without token")
    void meWithoutToken() {
        assertError(auth.me(null), 401, "AUTH_REQUIRED");
    }

    static Stream<Arguments> malformedHeaders() {
        return Stream.of(
                Arguments.of("Token scheme", (UnaryOperator<String>) t -> "Token " + t),
                Arguments.of("Bearer without token", (UnaryOperator<String>) t -> "Bearer"),
                Arguments.of("token without scheme", (UnaryOperator<String>) t -> t),
                Arguments.of("extra part", (UnaryOperator<String>) t -> "Bearer " + t + " extra"),
                Arguments.of("lowercase bearer", (UnaryOperator<String>) t -> "bearer " + t));
    }

    @ParameterizedTest(name = "{displayName} [{0}]")
    @Tag("regression")
    @DisplayName("AUTH-016 Malformed Authorization header")
    @MethodSource("malformedHeaders")
    void malformedAuthorizationHeader(String name, UnaryOperator<String> header) {
        assertError(auth.meWithAuthorizationHeader(header.apply(tokens.g1())), 401, "INVALID_TOKEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-017 Invalid (garbage) token")
    void garbageToken() {
        assertError(auth.me("not.a.jwt"), 401, "INVALID_TOKEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-018 Expired token")
    void expiredToken() {
        String token = Jwt.sign(Jwt.expiredPayload(seed.g1().id(), "GUEST"), Config.jwtSecret());
        assertError(auth.me(token), 401, "TOKEN_EXPIRED");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-019 Tampered token: role changed to ADMIN")
    void tamperedToken() {
        String token = Jwt.tamper(tokens.g1(), Map.of("role", "ADMIN"));
        assertError(auth.me(token), 401, "INVALID_TOKEN");

        RoomRequest room = RoomRequest.newRoom();
        assertError(rooms.create(token, room), 401, "INVALID_TOKEN");
        assertThat(data.roomNumberExists(room.number())).isFalse();
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-020 Token signed with the wrong secret")
    void wrongSecret() {
        String token = Jwt.sign(Jwt.validPayload(seed.g1().id(), "GUEST"), "wrong-secret");
        assertError(auth.me(token), 401, "INVALID_TOKEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-021 Unsigned token (alg: none)")
    void unsignedToken() {
        String token = Jwt.unsigned(Jwt.validPayload(seed.g1().id(), "GUEST"));
        assertError(auth.me(token), 401, "INVALID_TOKEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-022 Correctly signed token for a non-existent user")
    void tokenForUnknownUser() {
        String token = Jwt.sign(Jwt.validPayload(UNKNOWN_ID, "ADMIN"), Config.jwtSecret());
        assertError(auth.me(token), 401, "INVALID_TOKEN");
    }

    @Test
    @Tag("regression")
    @DisplayName("AUTH-023 Role is read from the database, not the token")
    void roleFromDatabase() {
        String token = Jwt.sign(Jwt.validPayload(seed.g1().id(), "ADMIN"), Config.jwtSecret()); // valid signature, lying role
        RoomRequest room = RoomRequest.newRoom();
        assertError(rooms.create(token, room), 403, "FORBIDDEN");
        assertThat(data.roomNumberExists(room.number())).isFalse();
    }
}
