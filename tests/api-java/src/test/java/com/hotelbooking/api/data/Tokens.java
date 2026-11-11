package com.hotelbooking.api.data;

import com.hotelbooking.api.clients.AuthClient;
import com.hotelbooking.api.config.Config;
import com.hotelbooking.api.model.Credentials;

/** T(ADMIN), T(G1), T(G2). Logged in once per run (tokens live 15 min, longer than the run). */
public record Tokens(String admin, String g1, String g2) {

    private static Tokens instance;

    public static synchronized Tokens get() {
        if (instance == null) {
            Seed.get(); // the seeded users must exist first
            instance = new Tokens(login(Config.admin()), login(Config.guest1()), login(Config.guest2()));
        }
        return instance;
    }

    private static String login(Credentials credentials) {
        var response = new AuthClient().login(credentials);
        if (response.statusCode() != 200) {
            throw new IllegalStateException("Login failed for " + credentials.email() + ": " + response.asString());
        }
        return response.jsonPath().getString("accessToken");
    }
}
