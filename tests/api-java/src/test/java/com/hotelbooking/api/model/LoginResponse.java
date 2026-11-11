package com.hotelbooking.api.model;

/** Response of POST /auth/login. */
public record LoginResponse(String accessToken, String tokenType, int expiresIn, User user) {}
