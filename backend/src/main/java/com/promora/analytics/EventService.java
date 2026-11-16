package com.promora.analytics;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.promora.common.Util;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Application-side product analytics. Reports are built from these rows and from business tables, never from constants. */
@Service
public class EventService {
    public static final Set<String> CLIENT_EVENTS = Set.of("landing_page_viewed", "signup_started", "promotion_shared", "pricing_plan_clicked");
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public EventService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    public void track(String name, UUID userId, Map<String, ?> properties) { track(name, userId, null, properties, null, null, null, null); }

    public void track(String name, UUID userId, String anonymousId, Map<String, ?> properties, String path, String utmSource, String utmMedium, String utmCampaign) {
        String props = null;
        try { if (properties != null && !properties.isEmpty()) props = Util.truncate(mapper.writeValueAsString(properties), 2000); } catch (Exception ignored) { }
        jdbc.update("INSERT INTO analytics_events (name, user_id, anonymous_id, properties, path, utm_source, utm_medium, utm_campaign) VALUES (?,?,?,?,?,?,?,?)",
                name, userId, Util.truncate(anonymousId, 64), props, Util.truncate(path, 300),
                Util.truncate(utmSource, 100), Util.truncate(utmMedium, 100), Util.truncate(utmCampaign, 100));
    }
}
