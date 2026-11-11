package com.hotelbooking.api.config;

import com.hotelbooking.api.model.Credentials;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

/**
 * Test configuration. Everything comes from environment variables.
 * Variables that are not set are read from the repository's env file
 * (default {@code .env.test}; choose another with {@code ENV_FILE=.env.dev}).
 * Real environment variables (e.g. in CI) always win.
 */
public final class Config {

    private static final Map<String, String> ENV_FILE = loadEnvFile();

    private Config() {}

    public static String baseUrl() { return required("BASE_URL").replaceAll("/+$", ""); }
    public static String paymentUrl() { return required("PAYMENT_URL").replaceAll("/+$", ""); }
    /** Needed to build expired / forged tokens (AUTH-018, AUTH-022, AUTH-023). */
    public static String jwtSecret() { return required("JWT_SECRET"); }
    public static int checkinHourUtc() { return Integer.parseInt(optional("CHECKIN_HOUR_UTC", "14")); }

    public static Credentials admin() { return credentials("SEED_ADMIN"); }
    public static Credentials guest1() { return credentials("SEED_GUEST1"); }
    public static Credentials guest2() { return credentials("SEED_GUEST2"); }

    /** Folder with the shared JSON schemas (tests/schemas). */
    public static Path schemaDir() { return repoRoot().resolve("tests").resolve("schemas"); }

    private static Credentials credentials(String prefix) {
        return new Credentials(required(prefix + "_EMAIL").toLowerCase(), required(prefix + "_PASSWORD"));
    }

    private static String required(String name) {
        String value = optional(name, null);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing environment variable " + name + " (see .env.example)");
        }
        return value;
    }

    private static String optional(String name, String fallback) {
        String fromEnv = System.getenv(name);
        if (fromEnv != null && !fromEnv.isBlank()) return fromEnv;
        return ENV_FILE.getOrDefault(name, fallback);
    }

    /** The project runs from tests/api-java, so the repository root is two levels up. */
    private static Path repoRoot() {
        return Path.of(System.getProperty("repo.root", "../..")).toAbsolutePath().normalize();
    }

    /** Minimal KEY=VALUE parser for the .env files (comments and blank lines ignored). */
    private static Map<String, String> loadEnvFile() {
        String fileName = System.getenv().getOrDefault("ENV_FILE", ".env.test");
        Path file = repoRoot().resolve(fileName);
        Map<String, String> values = new HashMap<>();
        if (!Files.exists(file)) return values;
        try {
            for (String line : Files.readAllLines(file)) {
                String trimmed = line.trim();
                int eq = trimmed.indexOf('=');
                if (trimmed.isEmpty() || trimmed.startsWith("#") || eq < 1) continue;
                values.put(trimmed.substring(0, eq).trim(), trimmed.substring(eq + 1).trim());
            }
        } catch (IOException e) {
            throw new IllegalStateException("Cannot read " + file, e);
        }
        return values;
    }
}
