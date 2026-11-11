package com.hotelbooking.api.model;

import java.util.UUID;

/** Body of POST /auth/register. NEW_USER in the catalog. */
public record RegisterRequest(String email, String password, String fullName) {

    public static RegisterRequest newUser() {
        return new RegisterRequest(uniqueEmail(), "Secret123!", "Test User");
    }

    public static String uniqueEmail() {
        return "user-" + UUID.randomUUID().toString().substring(0, 12) + "@example.test";
    }

    public RegisterRequest withEmail(String value) { return new RegisterRequest(value, password, fullName); }
    public RegisterRequest withPassword(String value) { return new RegisterRequest(email, value, fullName); }
    public RegisterRequest withFullName(String value) { return new RegisterRequest(email, password, value); }
}
