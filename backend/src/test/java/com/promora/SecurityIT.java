package com.promora;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/** Authentication, role and ownership boundaries. */
class SecurityIT extends IntegrationTest {

    @Test
    void registrationLoginAndPasswordRules() throws Exception {
        String email = unique("user");
        assertThat(POST("/api/v1/auth/register", null, Map.of("email", email, "password", "short", "fullName", "A B", "acceptTerms", true)).status()).isEqualTo(422);
        assertThat(POST("/api/v1/auth/register", null, Map.of("email", email, "password", PASSWORD, "fullName", "A B", "acceptTerms", false)).status()).isEqualTo(422);
        Res ok = POST("/api/v1/auth/register", null, Map.of("email", email, "password", PASSWORD, "fullName", "A B", "acceptTerms", true));
        assertThat(ok.status()).isEqualTo(201);
        assertThat(ok.raw().getResponse().getHeader("Set-Cookie")).contains("promora_refresh=").contains("HttpOnly").contains("SameSite=Lax");
        assertThat(ok.body().get("user").has("passwordHash")).isFalse();
        assertThat(jdbc.queryForObject("SELECT password_hash FROM users WHERE email = ?", String.class, email)).startsWith("$2").doesNotContain(PASSWORD);
        assertThat(POST("/api/v1/auth/register", null, Map.of("email", email.toUpperCase(), "password", PASSWORD, "fullName", "A B", "acceptTerms", true)).status()).isEqualTo(409);
        Res bad = POST("/api/v1/auth/login", null, Map.of("email", email, "password", "Wrong-pass-1"));
        Res unknown = POST("/api/v1/auth/login", null, Map.of("email", unique("nobody"), "password", "Wrong-pass-1"));
        assertThat(bad.status()).isEqualTo(401);
        assertThat(unknown.body().get("message").asText()).isEqualTo(bad.body().get("message").asText()); // no account enumeration
        assertThat(GET("/api/v1/me", "not-a-token").status()).isEqualTo(401);
        assertThat(GET("/api/v1/me", null).status()).isEqualTo(401);
    }

    @Test
    void unverifiedEmailCannotSubmitCampaigns() throws Exception {
        String email = unique("unverified");
        Res r = POST("/api/v1/auth/register", null, Map.of("email", email, "password", PASSWORD, "fullName", "A B", "acceptTerms", true));
        String token = r.body().get("accessToken").asText();
        PUT("/api/v1/me/advertiser-profile", token, Map.of("businessName", "Unverified Biz"));
        Res c = POST("/api/v1/advertiser/campaigns", token, campaignBody("CPC", 500, 100000));
        assertThat(c.status()).isEqualTo(201);
        Res submit = POST("/api/v1/advertiser/campaigns/" + c.body().get("campaign").get("id").asText() + "/submit", token, null);
        assertThat(submit.status()).isEqualTo(403);
        assertThat(submit.body().get("code").asText()).isEqualTo("EMAIL_NOT_VERIFIED");
    }

    @Test
    void passwordResetInvalidatesOldTokensAndRefreshRotationDetectsReuse() throws Exception {
        String email = unique("reset");
        String oldAccess = register(email, "10.20.0.1", null);
        Res login = POST("/api/v1/auth/login", null, Map.of("email", email, "password", PASSWORD));
        String cookie = login.raw().getResponse().getCookie("promora_refresh").getValue();
        Res refreshed = call(post("/api/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("promora_refresh", cookie)), null, null, null, null);
        assertThat(refreshed.status()).isEqualTo(200);
        String rotated = refreshed.raw().getResponse().getCookie("promora_refresh").getValue();
        // Re-using the already rotated token is treated as theft: it fails and the newer token is revoked too
        assertThat(call(post("/api/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("promora_refresh", cookie)), null, null, null, null).status()).isEqualTo(401);
        assertThat(call(post("/api/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("promora_refresh", rotated)), null, null, null, null).status()).isEqualTo(401);

        Res forgot = POST("/api/v1/auth/forgot-password", null, Map.of("email", email));
        String resetToken = forgot.body().get("devResetToken").asText();
        assertThat(POST("/api/v1/auth/forgot-password", null, Map.of("email", unique("ghost"))).status()).isEqualTo(200); // same answer for unknown email
        assertThat(POST("/api/v1/auth/reset-password", null, Map.of("token", resetToken, "password", "New-passw0rd-9")).status()).isEqualTo(200);
        assertThat(POST("/api/v1/auth/reset-password", null, Map.of("token", resetToken, "password", "Another-passw0rd-9")).status()).isEqualTo(400); // single use
        assertThat(GET("/api/v1/me", oldAccess).status()).isEqualTo(401); // access tokens from before the reset stop working
        assertThat(POST("/api/v1/auth/login", null, Map.of("email", email, "password", PASSWORD)).status()).isEqualTo(401);
        assertThat(POST("/api/v1/auth/login", null, Map.of("email", email, "password", "New-passw0rd-9")).status()).isEqualTo(200);
    }

    @Test
    void adminApiIsClosedToEveryoneButStaffWithTheRightPermission() throws Exception {
        String user = register(unique("plain"), "10.21.0.1", null);
        String adv = advertiser(unique("adv"), "10.21.0.2", null);
        String adminOnly = admin("ADMIN");
        String superAdmin = admin("ADMIN", "SUPER_ADMIN");
        List<String> adminGets = List.of("/api/v1/admin/dashboard", "/api/v1/admin/users", "/api/v1/admin/campaigns", "/api/v1/admin/verifications",
                "/api/v1/admin/finance/summary", "/api/v1/admin/finance/transactions", "/api/v1/admin/finance/commissions", "/api/v1/admin/finance/payouts",
                "/api/v1/admin/referrals", "/api/v1/admin/risk-flags", "/api/v1/admin/fraud/click-patterns", "/api/v1/admin/moderation/reports",
                "/api/v1/admin/moderation/history", "/api/v1/admin/settings", "/api/v1/admin/audit-logs", "/api/v1/admin/email-log",
                "/api/v1/admin/contact-messages", "/api/v1/admin/analytics/acquisition", "/api/v1/admin/analytics/revenue");
        for (String url : adminGets) {
            assertThat(GET(url, null).status()).as("anonymous " + url).isEqualTo(401);
            assertThat(GET(url, user).status()).as("user " + url).isEqualTo(403);
            assertThat(GET(url, adv).status()).as("advertiser " + url).isEqualTo(403);
            assertThat(GET(url, superAdmin).status()).as("super admin " + url).isEqualTo(200);
        }
        // Granular permissions: ADMIN lacks audit.view, settings.manage and user.roles
        assertThat(GET("/api/v1/admin/audit-logs", adminOnly).status()).isEqualTo(403);
        assertThat(PUT("/api/v1/admin/settings/payout.minimum_paise", adminOnly, Map.of("value", "100")).status()).isEqualTo(403);
        assertThat(GET("/api/v1/admin/users", adminOnly).status()).isEqualTo(200);
        String targetId = jdbc.queryForObject("SELECT id::text FROM users ORDER BY created_at LIMIT 1", String.class);
        assertThat(PUT("/api/v1/admin/users/" + targetId + "/roles", adminOnly, Map.of("roles", List.of("USER", "SUPER_ADMIN"))).status()).isEqualTo(403);
        // No public route can create staff: registration ignores any role field
        String sneaky = unique("sneaky");
        POST("/api/v1/auth/register", null, Map.of("email", sneaky, "password", PASSWORD, "fullName", "S N", "acceptTerms", true, "roles", List.of("ADMIN"), "role", "ADMIN"));
        assertThat(jdbc.queryForList("SELECT role_name FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.email = ?", String.class, sneaky)).containsExactly("USER");
        // Settings validation and audit
        assertThat(PUT("/api/v1/admin/settings/commission.platform_fee_bps", superAdmin, Map.of("value", "20000")).status()).isEqualTo(422);
        assertThat(PUT("/api/v1/admin/settings/commission.platform_fee_bps", superAdmin, Map.of("value", "1500")).status()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action = 'SETTING_CHANGED'", Long.class)).isGreaterThanOrEqualTo(1);
    }

    @Test
    void ownershipRolesAndSuspensionAreEnforcedOnTheServer() throws Exception {
        String superAdmin = admin("ADMIN", "SUPER_ADMIN");
        String owner = advertiser(unique("owner"), "10.22.0.1", null);
        String otherEmail = unique("other");
        String other = advertiser(otherEmail, "10.22.0.2", null);
        String plain = register(unique("plain"), "10.22.0.3", null);
        String id = POST("/api/v1/advertiser/campaigns", owner, campaignBody("CPC", 500, 100000)).body().get("campaign").get("id").asText();

        assertThat(GET("/api/v1/advertiser/campaigns/" + id, other).status()).isEqualTo(404);
        assertThat(PUT("/api/v1/advertiser/campaigns/" + id, other, campaignBody("CPC", 500, 100000)).status()).isEqualTo(404);
        assertThat(POST("/api/v1/advertiser/campaigns/" + id + "/cancel", other, null).status()).isEqualTo(404);
        assertThat(POST("/api/v1/advertiser/campaigns", plain, campaignBody("CPC", 500, 100000)).status()).isEqualTo(403); // no ADVERTISER role
        assertThat(GET("/api/v1/promoter/dashboard", owner).status()).isEqualTo(403); // no PROMOTER role
        assertThat(POST("/api/v1/admin/campaigns/" + id + "/approve", owner, null).status()).isEqualTo(403);
        // State machine: a draft cannot be approved, an owner cannot approve by calling submit twice
        assertThat(POST("/api/v1/admin/campaigns/" + id + "/approve", superAdmin, null).status()).isEqualTo(409);
        assertThat(POST("/api/v1/admin/campaigns/" + id + "/reject", superAdmin, Map.of()).status()).isEqualTo(409);
        POST("/api/v1/advertiser/campaigns/" + id + "/submit", owner, null);
        assertThat(POST("/api/v1/advertiser/campaigns/" + id + "/submit", owner, null).status()).isEqualTo(409);
        assertThat(POST("/api/v1/admin/campaigns/" + id + "/reject", superAdmin, Map.of("reason", " ")).status()).isEqualTo(422); // reason required
        // Payments: another user's transaction and forged signatures are refused; nothing becomes PAID
        POST("/api/v1/admin/campaigns/" + id + "/approve", superAdmin, null);
        Res order = POSTKEY("/api/v1/payments/campaigns/" + id + "/order", owner, null, "sec-order-" + id);
        String txId = order.body().get("transactionId").asText();
        assertThat(POSTKEY("/api/v1/payments/campaigns/" + id + "/order", owner, null, "sec-order-" + id).body().get("transactionId").asText()).isEqualTo(txId);
        assertThat(POST("/api/v1/payments/verify", owner, Map.of("transactionId", txId, "paymentId", "pay_fake", "signature", "deadbeef")).status()).isEqualTo(400);
        assertThat(POST("/api/v1/payments/sandbox/" + txId + "/complete", other, null).status()).isEqualTo(404);
        assertThat(jdbc.queryForObject("SELECT status FROM transactions WHERE id = ?::uuid", String.class, txId)).isEqualTo("CREATED");
        assertThat(jdbc.queryForObject("SELECT funded_paise FROM campaigns WHERE id = ?::uuid", Long.class, id)).isZero();
        assertThat(call(post("/api/v1/payments/webhook/razorpay"), null, "{\"event\":\"payment.captured\"}", null, Map.of("X-Razorpay-Signature", "bad")).status()).isEqualTo(400);

        // Suspension takes effect on the very next request and blocks login
        String otherId = jdbc.queryForObject("SELECT id::text FROM users WHERE email = ?", String.class, otherEmail);
        assertThat(POST("/api/v1/admin/users/" + otherId + "/suspend", superAdmin, Map.of()).status()).isEqualTo(422);
        assertThat(POST("/api/v1/admin/users/" + otherId + "/suspend", superAdmin, Map.of("reason", "Policy breach")).status()).isEqualTo(200);
        assertThat(GET("/api/v1/me", other).status()).isEqualTo(401);
        assertThat(POST("/api/v1/auth/login", null, Map.of("email", otherEmail, "password", PASSWORD)).status()).isEqualTo(403);
        assertThat(POST("/api/v1/admin/users/" + otherId + "/reactivate", superAdmin, null).status()).isEqualTo(200);
        assertThat(POST("/api/v1/auth/login", null, Map.of("email", otherEmail, "password", PASSWORD)).status()).isEqualTo(200);
    }

    @Test
    void webhookWithValidSignatureMarksPaymentPaidExactlyOnce() throws Exception {
        String superAdmin = admin("ADMIN", "SUPER_ADMIN");
        String owner = advertiser(unique("hook"), "10.23.0.1", null);
        String id = POST("/api/v1/advertiser/campaigns", owner, campaignBody("CPC", 500, 100000)).body().get("campaign").get("id").asText();
        POST("/api/v1/advertiser/campaigns/" + id + "/submit", owner, null);
        POST("/api/v1/admin/campaigns/" + id + "/approve", superAdmin, null);
        Res order = POSTKEY("/api/v1/payments/campaigns/" + id + "/order", owner, null, "hook-order-" + id);
        String payload = "{\"event\":\"payment.captured\",\"payload\":{\"payment\":{\"entity\":{\"id\":\"pay_hook_" + id.substring(0, 8)
                + "\",\"order_id\":\"" + order.body().get("orderId").asText() + "\"}}}}";
        String signature = com.promora.common.Util.hmacSha256Hex("test-secret-test-secret-test-secret-test-secret-0123456789", payload);
        Map<String, String> headers = Map.of("X-Razorpay-Signature", signature, "X-Razorpay-Event-Id", "evt_" + id);
        assertThat(call(post("/api/v1/payments/webhook/razorpay"), null, payload, null, headers).status()).isEqualTo(200);
        assertThat(call(post("/api/v1/payments/webhook/razorpay"), null, payload, null, headers).status()).isEqualTo(200); // duplicate delivery
        assertThat(jdbc.queryForObject("SELECT funded_paise FROM campaigns WHERE id = ?::uuid", Long.class, id)).isEqualTo(100000L);
        assertThat(jdbc.queryForObject("SELECT status FROM campaigns WHERE id = ?::uuid", String.class, id)).isEqualTo("ACTIVE");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM webhook_events WHERE event_id = ?", Long.class, "evt_" + id)).isEqualTo(1);
    }
}
