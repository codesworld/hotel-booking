package com.hotelbooking.api.core;

import com.fasterxml.jackson.databind.JsonNode;
import com.hotelbooking.api.config.Config;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SchemaValidatorsConfig;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import io.restassured.response.Response;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static org.assertj.core.api.Assertions.assertThat;

/** Validates response bodies against the shared draft-07 schemas in tests/schemas/. */
public final class SchemaValidator {

    private static final JsonSchemaFactory FACTORY = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);
    private static final SchemaValidatorsConfig CONFIG = SchemaValidatorsConfig.builder()
            .formatAssertionsEnabled(true) // e.g. "date-time" is checked, not just documented
            .build();
    private static final Map<String, JsonSchema> CACHE = new ConcurrentHashMap<>();

    private SchemaValidator() {}

    /** Fails if the body does not match tests/schemas/&lt;name&gt;.schema.json. */
    public static void assertMatchesSchema(Response response, String name) {
        String body = response.asString();
        Set<ValidationMessage> errors;
        try {
            JsonNode json = Json.MAPPER.readTree(body);
            errors = schema(name).validate(json);
        } catch (IOException e) {
            throw new AssertionError("Body is not valid JSON: " + body, e);
        }
        assertThat(errors).as("Body does not match %s.schema.json. Body: %s", name, body).isEmpty();
    }

    private static JsonSchema schema(String name) {
        return CACHE.computeIfAbsent(name, n -> {
            try (InputStream in = Files.newInputStream(Config.schemaDir().resolve(n + ".schema.json"))) {
                return FACTORY.getSchema(in, CONFIG);
            } catch (IOException e) {
                throw new IllegalStateException("Cannot read schema " + n, e);
            }
        });
    }
}
