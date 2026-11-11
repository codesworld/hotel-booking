package com.hotelbooking.api.model;

/** Body of POST /auth/login. */
public record Credentials(String email, String password) {}
