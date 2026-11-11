package com.hotelbooking.api.model;

import java.util.Map;

/** The standard error body: { "error": { "code", "message", "field?", "details?" } }. */
public record ApiError(Body error) {
    public record Body(String code, String message, String field, Map<String, Object> details) {}
}
