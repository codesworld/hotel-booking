package com.hotelbooking.api.core;

import com.fasterxml.jackson.core.JsonProcessingException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/** Builds JWTs for the token tests (expired, tampered, forged, unsigned). */
public final class Jwt {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private Jwt() {}

    /** A correctly signed HS256 token. */
    public static String sign(Map<String, Object> payload, String secret) {
        String unsigned = encode(Map.of("alg", "HS256", "typ", "JWT")) + "." + encode(payload);
        return unsigned + "." + hmacSha256(unsigned, secret);
    }

    /** Payload that expired 10 seconds ago. */
    public static Map<String, Object> expiredPayload(String sub, String role) {
        long now = Instant.now().getEpochSecond();
        return Map.of("sub", sub, "role", role, "iat", now - 1000, "exp", now - 10);
    }

    /** Payload valid for the next 10 minutes. */
    public static Map<String, Object> validPayload(String sub, String role) {
        long now = Instant.now().getEpochSecond();
        return Map.of("sub", sub, "role", role, "iat", now, "exp", now + 600);
    }

    /** Changes payload fields but keeps the ORIGINAL signature. */
    @SuppressWarnings("unchecked")
    public static String tamper(String token, Map<String, Object> changes) {
        String[] parts = token.split("\\.");
        try {
            Map<String, Object> payload = new LinkedHashMap<>(
                    Json.MAPPER.readValue(DECODER.decode(parts[1]), Map.class));
            payload.putAll(changes);
            return parts[0] + "." + encode(payload) + "." + parts[2];
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("Not a JWT: " + token, e);
        }
    }

    /** "alg: none" token with an empty signature. */
    public static String unsigned(Map<String, Object> payload) {
        return encode(Map.of("alg", "none", "typ", "JWT")) + "." + encode(payload) + ".";
    }

    private static String encode(Map<String, Object> json) {
        try {
            return ENCODER.encodeToString(Json.MAPPER.writeValueAsBytes(json));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return ENCODER.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
