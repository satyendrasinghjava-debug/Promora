package com.promora;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.PostgreSQLContainer;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * Full-stack tests against a real PostgreSQL: a Testcontainers instance when Docker is available,
 * otherwise the database named by TEST_DB_URL (default localhost promora_test). The schema is rebuilt
 * from the Flyway migrations at start-up, so every run also validates the migrations and the JPA mappings.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IntegrationTest.CleanDatabase.class)
public abstract class IntegrationTest {
    static final String BROWSER = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    static final String PASSWORD = "Passw0rd-123";
    static PostgreSQLContainer<?> container;

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry registry) {
        boolean docker;
        try { docker = DockerClientFactory.instance().isDockerAvailable(); } catch (Throwable t) { docker = false; }
        if (docker) {
            if (container == null) { container = new PostgreSQLContainer<>("postgres:16-alpine"); container.start(); }
            registry.add("spring.datasource.url", container::getJdbcUrl);
            registry.add("spring.datasource.username", container::getUsername);
            registry.add("spring.datasource.password", container::getPassword);
        }
    }

    @TestConfiguration
    static class CleanDatabase {
        @Bean
        FlywayMigrationStrategy cleanMigrate() {
            return (Flyway flyway) -> { flyway.clean(); flyway.migrate(); };
        }
    }

    @Autowired protected MockMvc mvc;
    @Autowired protected ObjectMapper mapper;
    @Autowired protected JdbcTemplate jdbc;

    protected record Res(int status, JsonNode body, MvcResult raw) {}

    protected Res call(MockHttpServletRequestBuilder builder, String token, Object body, String ip, Map<String, String> headers) throws Exception {
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (body != null) builder.contentType(MediaType.APPLICATION_JSON).content(body instanceof String s ? s : mapper.writeValueAsString(body));
        if (headers != null) headers.forEach(builder::header);
        String addr = ip == null ? "10.1.1.1" : ip;
        builder.with(r -> { r.setRemoteAddr(addr); return r; });
        MvcResult r = mvc.perform(builder).andReturn();
        String content = r.getResponse().getContentAsString();
        JsonNode json = null;
        try { if (!content.isBlank()) json = mapper.readTree(content); } catch (Exception ignored) { }
        return new Res(r.getResponse().getStatus(), json, r);
    }
    protected Res GET(String url, String token) throws Exception { return call(get(url), token, null, null, null); }
    protected Res POST(String url, String token, Object body) throws Exception { return call(post(url), token, body, null, null); }
    protected Res PUT(String url, String token, Object body) throws Exception { return call(put(url), token, body, null, null); }
    protected Res POSTKEY(String url, String token, Object body, String key) throws Exception { return call(post(url), token, body, null, Map.of("Idempotency-Key", key)); }

    protected String unique(String prefix) { return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@test.promora"; }

    /** Registers a verified user from the given IP and returns its access token. */
    protected String register(String email, String ip, String referralCode) throws Exception {
        Map<String, Object> body = new java.util.HashMap<>(Map.of("email", email, "password", PASSWORD, "fullName", "Test User", "acceptTerms", true));
        if (referralCode != null) body.put("referralCode", referralCode);
        Res r = call(post("/api/v1/auth/register"), null, body, ip, null);
        assertThat(r.status()).isEqualTo(201);
        assertThat(POST("/api/v1/auth/verify-email", null, Map.of("token", r.body().get("devVerificationToken").asText())).status()).isEqualTo(200);
        return login(email);
    }
    protected String login(String email) throws Exception {
        Res r = POST("/api/v1/auth/login", null, Map.of("email", email, "password", PASSWORD));
        assertThat(r.status()).isEqualTo(200);
        return r.body().get("accessToken").asText();
    }
    protected String admin(String... roles) throws Exception {
        String email = unique("admin");
        register(email, "10.9.9.9", null);
        for (String role : roles) jdbc.update("INSERT INTO user_roles (user_id, role_name) SELECT id, ? FROM users WHERE email = ?", role, email);
        return login(email);
    }
    protected String advertiser(String email, String ip, String ref) throws Exception {
        String token = register(email, ip, ref);
        assertThat(PUT("/api/v1/me/advertiser-profile", token, Map.of("businessName", "Biz " + UUID.randomUUID().toString().substring(0, 6))).status()).isEqualTo(200);
        return token;
    }
    protected String promoter(String email, String ip, String ref) throws Exception {
        String token = register(email, ip, ref);
        assertThat(PUT("/api/v1/me/promoter-profile", token, Map.of("displayName", "Creator " + UUID.randomUUID().toString().substring(0, 6),
                "audienceSize", 5000, "upiId", "creator@upi")).status()).isEqualTo(200);
        return token;
    }
    protected String categoryId() { return jdbc.queryForObject("SELECT id::text FROM campaign_categories ORDER BY sort_order LIMIT 1", String.class); }

    protected Map<String, Object> campaignBody(String type, long rewardPaise, long budgetPaise) {
        return new java.util.HashMap<>(Map.of("title", "Test campaign " + UUID.randomUUID().toString().substring(0, 6),
                "description", "A complete description that is comfortably longer than forty characters for validation.",
                "categoryId", categoryId(), "objective", "WEBSITE_VISITS", "landingUrl", "https://example.com/landing",
                "rewardType", type, "rewardPaise", rewardPaise, "budgetPaise", budgetPaise, "applicationMode", "APPROVAL"));
    }

    /** Creates, submits, approves and funds (sandbox) a campaign; returns its id. */
    protected String liveCampaign(String advToken, String adminToken, String type, long reward, long budget) throws Exception {
        Res created = POST("/api/v1/advertiser/campaigns", advToken, campaignBody(type, reward, budget));
        assertThat(created.status()).isEqualTo(201);
        String id = created.body().get("campaign").get("id").asText();
        assertThat(POST("/api/v1/advertiser/campaigns/" + id + "/submit", advToken, null).status()).isEqualTo(200);
        assertThat(POST("/api/v1/admin/campaigns/" + id + "/approve", adminToken, null).status()).isEqualTo(200);
        Res order = POSTKEY("/api/v1/payments/campaigns/" + id + "/order", advToken, null, "fund-" + id);
        assertThat(order.status()).isEqualTo(200);
        assertThat(POST("/api/v1/payments/sandbox/" + order.body().get("transactionId").asText() + "/complete", advToken, null).status()).isEqualTo(200);
        return id;
    }

    /** Applies, gets approved and returns the tracking code. */
    protected String joinCampaign(String campaignId, String promoterToken, String advToken) throws Exception {
        Res applied = POST("/api/v1/campaigns/" + campaignId + "/applications", promoterToken, Map.of("pitch", "I can help", "disclosureAccepted", true));
        assertThat(applied.status()).isEqualTo(201);
        assertThat(POST("/api/v1/advertiser/applications/" + applied.body().get("id").asText() + "/approve", advToken, null).status()).isEqualTo(200);
        Res mine = GET("/api/v1/promoter/applications", promoterToken);
        for (JsonNode n : mine.body().get("items")) if (n.get("campaignId").asText().equals(campaignId)) return n.get("trackingCode").asText();
        throw new AssertionError("No tracking link");
    }

    protected Res click(String code, String ip, String userAgent) throws Exception {
        Map<String, String> headers = userAgent == null ? Map.of() : Map.of("User-Agent", userAgent);
        return call(get("/r/" + code), null, null, ip, headers);
    }
}
