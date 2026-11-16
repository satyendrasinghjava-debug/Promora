package com.promora;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** The core business flow end to end: campaign, moderation, funding, promotion, tracking, commission, payout. */
class MarketplaceFlowIT extends IntegrationTest {

    @Test
    void campaignLifecycleTrackingCommissionAndPayout() throws Exception {
        String adminToken = admin("ADMIN", "SUPER_ADMIN");
        String adv = advertiser(unique("adv"), "10.2.0.1", null);
        String pro = promoter(unique("pro"), "10.2.0.2", null);

        // Draft -> incomplete drafts cannot be submitted
        Map<String, Object> body = campaignBody("CPC", 25000, 100000);
        body.put("description", "too short");
        Res draft = POST("/api/v1/advertiser/campaigns", adv, body);
        assertThat(draft.status()).isEqualTo(201);
        String draftId = draft.body().get("campaign").get("id").asText();
        Res incomplete = POST("/api/v1/advertiser/campaigns/" + draftId + "/submit", adv, null);
        assertThat(incomplete.status()).isEqualTo(422);
        assertThat(incomplete.body().get("code").asText()).isEqualTo("CAMPAIGN_INCOMPLETE");

        // A campaign that is not live is invisible publicly and cannot be funded before approval
        assertThat(GET("/api/v1/public/campaigns/" + draftId, null).status()).isEqualTo(404);
        assertThat(POSTKEY("/api/v1/payments/campaigns/" + draftId + "/order", adv, null, "early-" + draftId).status()).isEqualTo(409);

        String id = liveCampaign(adv, adminToken, "CPC", 25000, 100000);
        Res pub = GET("/api/v1/public/campaigns/" + id, null);
        assertThat(pub.status()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT status FROM campaigns WHERE id = ?::uuid", String.class, id)).isEqualTo("ACTIVE");
        // Server-computed price: 1000.00 budget + 15% fee + 18% GST on the fee
        Map<String, Object> tx = jdbc.queryForMap("SELECT base_paise, fee_paise, tax_paise, amount_paise, status FROM transactions WHERE campaign_id = ?::uuid", id);
        assertThat(tx.get("base_paise")).isEqualTo(100000L);
        assertThat(tx.get("fee_paise")).isEqualTo(15000L);
        assertThat(tx.get("tax_paise")).isEqualTo(2700L);
        assertThat(tx.get("amount_paise")).isEqualTo(117700L);

        // Editing a live campaign is refused; marketplace search finds it
        assertThat(PUT("/api/v1/advertiser/campaigns/" + id, adv, campaignBody("CPC", 1, 1)).status()).isEqualTo(409);
        assertThat(GET("/api/v1/public/campaigns?rewardType=CPC&sort=reward", null).body().get("total").asLong()).isGreaterThanOrEqualTo(1);

        // Application needs the disclosure acknowledgement; duplicates are refused
        assertThat(POST("/api/v1/campaigns/" + id + "/applications", pro, Map.of("disclosureAccepted", false)).status()).isEqualTo(422);
        String code = joinCampaign(id, pro, adv);
        assertThat(POST("/api/v1/campaigns/" + id + "/applications", pro, Map.of("disclosureAccepted", true)).status()).isEqualTo(409);

        // Tracking: first real visit qualifies; refresh, bot, and the promoter's own network do not
        Res first = click(code, "10.3.0.1", BROWSER);
        assertThat(first.status()).isEqualTo(302);
        assertThat(first.raw().getResponse().getHeader("Location")).startsWith("https://example.com/landing?utm_source=promora");
        click(code, "10.3.0.1", BROWSER);
        click(code, "10.3.0.1", BROWSER);
        click(code, "10.3.0.9", "curl/8.0");
        click(code, "10.3.0.10", null);
        click(code, "10.2.0.2", BROWSER); // promoter's sign-up address
        assertThat(jdbc.queryForObject("SELECT count(*) FROM click_events WHERE campaign_id = ?::uuid", Long.class, id)).isEqualTo(6);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM click_events WHERE campaign_id = ?::uuid AND qualified", Long.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForList("SELECT reject_reason FROM click_events WHERE campaign_id = ?::uuid AND NOT qualified ORDER BY created_at", String.class, id))
                .containsExactly("DUPLICATE", "DUPLICATE", "BOT", "BOT", "SELF_CLICK");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM commissions WHERE campaign_id = ?::uuid", Long.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT spent_paise FROM campaigns WHERE id = ?::uuid", Long.class, id)).isEqualTo(25000L);

        // Earnings are pending during the hold; payout is refused until cleared
        Res earnings = GET("/api/v1/promoter/earnings", pro);
        assertThat(earnings.body().get("balances").get("pendingPaise").asLong()).isEqualTo(25000);
        assertThat(POSTKEY("/api/v1/promoter/payouts", pro, null, "payout-key-0001").status()).isEqualTo(422);

        String commissionId = jdbc.queryForObject("SELECT id::text FROM commissions WHERE campaign_id = ?::uuid", String.class, id);
        assertThat(POST("/api/v1/admin/finance/commissions/" + commissionId + "/release", adminToken, null).status()).isEqualTo(200);

        // Idempotent payout request: same key, same payout, commission linked once
        Res p1 = POSTKEY("/api/v1/promoter/payouts", pro, null, "payout-key-0002");
        Res p2 = POSTKEY("/api/v1/promoter/payouts", pro, null, "payout-key-0002");
        assertThat(p1.status()).isEqualTo(201);
        assertThat(p2.body().get("id").asText()).isEqualTo(p1.body().get("id").asText());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM payout_requests", Long.class)).isEqualTo(1);
        assertThat(POSTKEY("/api/v1/promoter/payouts", pro, null, "payout-key-0003").status()).isEqualTo(422); // nothing left

        String payoutId = p1.body().get("id").asText();
        assertThat(POST("/api/v1/admin/finance/payouts/" + payoutId + "/mark-paid", adminToken, Map.of("reference", "UTR1")).status()).isEqualTo(409); // must approve first
        assertThat(POST("/api/v1/admin/finance/payouts/" + payoutId + "/approve", adminToken, null).status()).isEqualTo(200);
        assertThat(POST("/api/v1/admin/finance/payouts/" + payoutId + "/mark-paid", adminToken, Map.of()).status()).isEqualTo(422); // reference required
        assertThat(POST("/api/v1/admin/finance/payouts/" + payoutId + "/mark-paid", adminToken, Map.of("reference", "UTR123")).status()).isEqualTo(200);
        assertThat(POST("/api/v1/admin/finance/payouts/" + payoutId + "/mark-paid", adminToken, Map.of("reference", "UTR123")).status()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM transactions WHERE type = 'PAYOUT' AND reference_id = ?::uuid", Long.class, payoutId)).isEqualTo(1);
        assertThat(GET("/api/v1/promoter/earnings", pro).body().get("balances").get("paidPaise").asLong()).isEqualTo(25000);

        // Notifications were persisted for the promoter and can be read
        Res notes = GET("/api/v1/me/notifications", pro);
        assertThat(notes.body().get("unread").asLong()).isGreaterThan(0);
        assertThat(POST("/api/v1/me/notifications/read-all", pro, null).status()).isEqualTo(200);
        assertThat(GET("/api/v1/me/notifications", pro).body().get("unread").asLong()).isZero();

        // Audit trail exists for the admin decisions and cannot be altered
        assertThat(jdbc.queryForObject("SELECT count(*) FROM audit_logs WHERE action IN ('CAMPAIGN_APPROVE','PAYOUT_MARK_PAID')", Long.class)).isGreaterThanOrEqualTo(2);
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> jdbc.update("DELETE FROM audit_logs"));
    }

    @Test
    void budgetIsNeverOverspentAndCampaignCompletes() throws Exception {
        String adminToken = admin("ADMIN", "SUPER_ADMIN");
        String adv = advertiser(unique("adv"), "10.4.0.1", null);
        String pro = promoter(unique("pro"), "10.4.0.2", null);
        String id = liveCampaign(adv, adminToken, "CPC", 25000, 50000); // budget for exactly two rewards
        String code = joinCampaign(id, pro, adv);
        for (int i = 1; i <= 5; i++) click(code, "10.5.0." + i, BROWSER);
        Map<String, Object> c = jdbc.queryForMap("SELECT status, spent_paise, funded_paise FROM campaigns WHERE id = ?::uuid", id);
        assertThat(c.get("spent_paise")).isEqualTo(50000L);
        assertThat(c.get("status")).isEqualTo("COMPLETED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM commissions WHERE campaign_id = ?::uuid", Long.class, id)).isEqualTo(2);
        // The database itself refuses overspending
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class,
                () -> jdbc.update("UPDATE campaigns SET spent_paise = funded_paise + 1 WHERE id = ?::uuid", id));
    }

    @Test
    void leadCampaignDeduplicatesByEmail() throws Exception {
        String adminToken = admin("ADMIN", "SUPER_ADMIN");
        String adv = advertiser(unique("adv"), "10.6.0.1", null);
        String pro = promoter(unique("pro"), "10.6.0.2", null);
        Map<String, Object> body = campaignBody("CPL", 30000, 300000);
        body.remove("landingUrl");
        Res created = POST("/api/v1/advertiser/campaigns", adv, body);
        String id = created.body().get("campaign").get("id").asText();
        POST("/api/v1/advertiser/campaigns/" + id + "/submit", adv, null);
        POST("/api/v1/admin/campaigns/" + id + "/approve", adminToken, null);
        Res order = POSTKEY("/api/v1/payments/campaigns/" + id + "/order", adv, null, "fund-" + id);
        POST("/api/v1/payments/sandbox/" + order.body().get("transactionId").asText() + "/complete", adv, null);
        String code = joinCampaign(id, pro, adv);

        Map<String, Object> lead = Map.of("code", code, "name", "Meera Nair", "email", "meera@example.com", "phone", "+91 98765 43210", "consent", true);
        Map<String, String> ua = Map.of("User-Agent", BROWSER);
        assertThat(call(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/public/leads"), null, lead, "10.7.0.1", ua).status()).isEqualTo(200);
        assertThat(call(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/public/leads"), null, lead, "10.7.0.2", ua).status()).isEqualTo(200);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM conversion_events WHERE campaign_id = ?::uuid AND type = 'LEAD'", Long.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM commissions WHERE campaign_id = ?::uuid", Long.class, id)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM risk_flags WHERE type = 'DUPLICATE_CONVERSION'", Long.class)).isGreaterThanOrEqualTo(1);
        // Consent is mandatory
        Map<String, Object> noConsent = Map.of("code", code, "name", "No Consent", "email", "x@example.com", "consent", false);
        assertThat(call(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/v1/public/leads"), null, noConsent, "10.7.0.3", ua).status()).isEqualTo(422);
        // The advertiser sees the lead; the unique constraint blocks a duplicate at database level too
        JsonNode leads = GET("/api/v1/advertiser/campaigns/" + id, adv).body().get("leads");
        assertThat(leads.size()).isEqualTo(1);
        org.junit.jupiter.api.Assertions.assertThrows(Exception.class, () -> jdbc.update("""
                INSERT INTO conversion_events (campaign_id, tracking_link_id, promoter_user_id, type, dedupe_key)
                SELECT campaign_id, tracking_link_id, promoter_user_id, type, dedupe_key FROM conversion_events WHERE campaign_id = ?::uuid""", id));
    }
}
