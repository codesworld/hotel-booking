package com.hotelbooking.api.core;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;

import java.util.LinkedHashMap;
import java.util.Map;

/** The single Jackson mapper used for request and response bodies. */
public final class Json {

    public static final ObjectMapper MAPPER = JsonMapper.builder()
            // Strictness is enforced by the JSON schemas, so POJO mapping stays lenient.
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS)
            .build();

    private Json() {}

    /** Turns a request record into a mutable map, to remove fields or put wrong types in tests. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> toMap(Object value) {
        return MAPPER.convertValue(value, LinkedHashMap.class);
    }
}
