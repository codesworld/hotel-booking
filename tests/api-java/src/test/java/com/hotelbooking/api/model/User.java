package com.hotelbooking.api.model;

/** Response of POST /auth/register and GET /auth/me. */
public record User(String id, String email, String fullName, String role, String createdAt) {}
