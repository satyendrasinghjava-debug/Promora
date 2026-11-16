package com.promora.admin;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

/** Reads configurable platform rules. Values are read from the database on each call so admin changes apply at once. */
@Service
public class SettingsService {
    private final JdbcTemplate jdbc;

    public SettingsService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public String get(String key, String fallback) {
        List<String> v = jdbc.queryForList("SELECT value FROM platform_settings WHERE key = ?", String.class, key);
        return v.isEmpty() ? fallback : v.get(0);
    }

    public long getLong(String key, long fallback) {
        try { return Long.parseLong(get(key, String.valueOf(fallback)).trim()); } catch (NumberFormatException e) { return fallback; }
    }
}
