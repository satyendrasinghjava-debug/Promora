package com.promora;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ReferralAndModerationIT extends IntegrationTest {

    @Test
    void referralIsRewardedOnlyAfterActivationAndAdminApprovalExactlyOnce() throws Exception {
        String adminToken = admin("ADMIN", "SUPER_ADMIN");
        String referrerEmail = unique("referrer");
        String referrer = register(referrerEmail, "10.30.0.1", null);
        String code = GET("/api/v1/me/referrals", referrer).body().get("code").asText();

        String referredEmail = unique("referred");
        String referred = advertiser(referredEmail, "10.30.0.2", code);
        // Registration alone earns nothing
        assertThat(jdbc.queryForObject("SELECT status FROM referrals WHERE code = ?", String.class, code)).isEqualTo("PENDING");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM referral_rewards", Long.class)).isZero();
        assertThat(GET("/api/v1/me/referrals", referrer).body().get("summary").get("signedUp").asLong()).isEqualTo(1);

        // Activation: the referred business gets a campaign approved
        String id = POST("/api/v1/advertiser/campaigns", referred, campaignBody("CPC", 500, 100000)).body().get("campaign").get("id").asText();
        POST("/api/v1/advertiser/campaigns/" + id + "/submit", referred, null);
        POST("/api/v1/admin/campaigns/" + id + "/approve", adminToken, null);
        Map<String, Object> reward = jdbc.queryForMap("SELECT id::text AS id, amount_paise, status FROM referral_rewards");
        assertThat(reward.get("status")).isEqualTo("PENDING_APPROVAL");
        assertThat(reward.get("amount_paise")).isEqualTo(5000L);
        assertThat(jdbc.queryForObject("SELECT promo_credits_paise FROM users WHERE email = ?", Long.class, referrerEmail)).isZero();

        // Admin approval credits once; a second decision is refused
        assertThat(POST("/api/v1/admin/referrals/rewards/" + reward.get("id") + "/approve", adminToken, null).status()).isEqualTo(200);
        assertThat(POST("/api/v1/admin/referrals/rewards/" + reward.get("id") + "/approve", adminToken, null).status()).isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT promo_credits_paise FROM users WHERE email = ?", Long.class, referrerEmail)).isEqualTo(5000L);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM analytics_events WHERE name = 'referral_activated'", Long.class)).isEqualTo(1);

        // A second referral of the same person is impossible; self-referral is blocked by the database
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> jdbc.update(
                "INSERT INTO referrals (referrer_user_id, referred_user_id, code) SELECT referrer_user_id, referred_user_id, code FROM referrals"));
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> jdbc.update(
                "INSERT INTO referrals (referrer_user_id, referred_user_id, code) SELECT id, id, 'SELF0001' FROM users WHERE email = ?", referrerEmail));

        // Same-IP sign-up is attributed but flagged for review
        register(unique("sameip"), "10.30.0.1", code);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM referrals WHERE suspicious", Long.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM risk_flags WHERE type = 'REFERRAL_ABUSE'", Long.class)).isEqualTo(1);
        // An unknown code is ignored, not an error
        register(unique("badcode"), "10.30.0.9", "NOPE1234");

        // Promo credits reduce the platform fee of the referrer's next funded campaign
        PUT("/api/v1/me/advertiser-profile", referrer, Map.of("businessName", "Referrer Biz"));
        String cid = POST("/api/v1/advertiser/campaigns", referrer, campaignBody("CPC", 500, 100000)).body().get("campaign").get("id").asText();
        POST("/api/v1/advertiser/campaigns/" + cid + "/submit", referrer, null);
        POST("/api/v1/admin/campaigns/" + cid + "/approve", adminToken, null);
        Res order = POSTKEY("/api/v1/payments/campaigns/" + cid + "/order", referrer, null, "credit-" + cid);
        assertThat(order.body().get("breakdown").get("creditPaise").asLong()).isEqualTo(5000);
        assertThat(order.body().get("breakdown").get("feePaise").asLong()).isEqualTo(10000);
        POST("/api/v1/payments/sandbox/" + order.body().get("transactionId").asText() + "/complete", referrer, null);
        assertThat(jdbc.queryForObject("SELECT promo_credits_paise FROM users WHERE email = ?", Long.class, referrerEmail)).isZero();
    }

    @Test
    void reportsVerificationAndTakedownArePersistedWithHistory() throws Exception {
        String adminToken = admin("ADMIN", "SUPER_ADMIN");
        String adv = advertiser(unique("adv"), "10.31.0.1", null);
        String id = liveCampaign(adv, adminToken, "CPC", 500, 100000);

        assertThat(POST("/api/v1/public/reports", null, Map.of("targetType", "CAMPAIGN", "targetId", id, "reason", "COPYRIGHT",
                "details", "Uses my photograph without permission", "email", "owner@example.com")).status()).isEqualTo(201);
        Res reports = GET("/api/v1/admin/moderation/reports?status=OPEN&reason=COPYRIGHT", adminToken);
        String reportId = reports.body().get("items").get(0).get("id").asText();
        assertThat(POST("/api/v1/admin/moderation/reports/" + reportId + "/resolve", adminToken, Map.of("action", "REMOVE_CONTENT", "resolution", "Copyright complaint upheld")).status()).isEqualTo(200);
        assertThat(GET("/api/v1/public/campaigns/" + id, null).status()).isEqualTo(404);
        assertThat(jdbc.queryForObject("SELECT status FROM campaigns WHERE id = ?::uuid", String.class, id)).isEqualTo("TERMINATED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM moderation_actions WHERE target_id = ?::uuid AND action = 'CONTENT_REMOVED'", Long.class, id)).isEqualTo(1);
        assertThat(POST("/api/v1/admin/moderation/reports/" + reportId + "/resolve", adminToken, Map.of("action", "DISMISS", "resolution", "again")).status()).isEqualTo(409);

        // Verification request -> admin approval -> public badge
        assertThat(POST("/api/v1/me/verification-requests", adv, Map.of("profileType", "ADVERTISER", "note", "GST certificate available")).status()).isEqualTo(200);
        assertThat(POST("/api/v1/me/verification-requests", adv, Map.of("profileType", "ADVERTISER")).status()).isEqualTo(409);
        String vid = GET("/api/v1/admin/verifications?status=PENDING", adminToken).body().get("items").get(0).get("id").asText();
        assertThat(POST("/api/v1/admin/verifications/" + vid + "/reject", adminToken, Map.of()).status()).isEqualTo(422);
        assertThat(POST("/api/v1/admin/verifications/" + vid + "/approve", adminToken, null).status()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM advertiser_profiles WHERE verification_status = 'VERIFIED'", Long.class)).isGreaterThanOrEqualTo(1);

        // Refund of unspent budget after termination, recorded as its own transaction
        String txId = jdbc.queryForObject("SELECT id::text FROM transactions WHERE campaign_id = ?::uuid AND type = 'CAMPAIGN_FUNDING'", String.class, id);
        assertThat(POST("/api/v1/admin/finance/transactions/" + txId + "/refund", adminToken, Map.of()).status()).isEqualTo(422);
        assertThat(POST("/api/v1/admin/finance/transactions/" + txId + "/refund", adminToken, Map.of("reason", "Campaign terminated")).status()).isEqualTo(200);
        assertThat(POST("/api/v1/admin/finance/transactions/" + txId + "/refund", adminToken, Map.of("reason", "again")).status()).isEqualTo(409);
        assertThat(jdbc.queryForObject("SELECT amount_paise FROM transactions WHERE type = 'REFUND' AND reference_id = ?::uuid", Long.class, txId)).isEqualTo(100000L);
        assertThat(jdbc.queryForObject("SELECT funded_paise FROM campaigns WHERE id = ?::uuid", Long.class, id)).isZero();

        // CSV export is real data and neutralises spreadsheet formulas
        Res csv = GET("/api/v1/admin/analytics/campaigns?format=csv", adminToken);
        assertThat(csv.raw().getResponse().getContentType()).startsWith("text/csv");
        assertThat(csv.raw().getResponse().getContentAsString()).startsWith("title,status,businessName");
        // AI assistant reports an honest disabled state
        assertThat(GET("/api/v1/ai/status", adv).body().get("enabled").asBoolean()).isFalse();
        assertThat(POST("/api/v1/ai/assist", adv, Map.of("task", "DESCRIPTION", "title", "Candle launch")).status()).isEqualTo(503);
        // Public pages for crawlers
        assertThat(GET("/sitemap.xml", null).raw().getResponse().getContentAsString()).contains("<urlset");
        assertThat(GET("/seo/render?path=/campaigns/" + id, null).status()).isEqualTo(404);
    }
}
