package com.promora.promoter;

import com.promora.common.PageResponse;
import com.promora.common.Sql;
import com.promora.config.PromoraProperties;
import com.promora.marketplace.ApplicationService;
import com.promora.marketplace.CampaignApplication;
import com.promora.payout.PayoutRequest;
import com.promora.payout.PayoutService;
import com.promora.security.Current;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Promoter")
public class PromoterController {
    private final ApplicationService applications;
    private final PayoutService payouts;
    private final PromoraProperties props;
    private final Sql sql;

    public PromoterController(ApplicationService applications, PayoutService payouts, PromoraProperties props, Sql sql) {
        this.applications = applications; this.payouts = payouts; this.props = props; this.sql = sql;
    }

    private Map<String, Object> balances(UUID u) {
        return sql.one("""
                SELECT coalesce(sum(amount_paise) FILTER (WHERE status = 'PENDING'), 0) AS pending_paise,
                       coalesce(sum(amount_paise) FILTER (WHERE status = 'APPROVED' AND payout_request_id IS NULL), 0) AS available_paise,
                       coalesce(sum(amount_paise) FILTER (WHERE status = 'APPROVED' AND payout_request_id IS NOT NULL), 0) AS in_payout_paise,
                       coalesce(sum(amount_paise) FILTER (WHERE status = 'PAID'), 0) AS paid_paise
                FROM commissions WHERE promoter_user_id = :u""", Map.of("u", u));
    }

    @GetMapping("/promoter/dashboard")
    @PreAuthorize("hasRole('PROMOTER')")
    public Map<String, Object> dashboard() {
        UUID u = Current.user().id();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("balances", balances(u));
        m.put("summary", sql.one("""
                SELECT (SELECT count(*) FROM campaign_applications WHERE user_id = :u AND status = 'APPROVED') AS approved_campaigns,
                       (SELECT count(*) FROM campaign_applications WHERE user_id = :u AND status = 'PENDING') AS pending_applications,
                       (SELECT count(*) FROM click_events WHERE promoter_user_id = :u) AS clicks,
                       (SELECT count(*) FROM click_events WHERE promoter_user_id = :u AND qualified) AS qualified_clicks,
                       (SELECT count(*) FROM conversion_events WHERE promoter_user_id = :u AND status = 'VERIFIED') AS conversions""", Map.of("u", u)));
        m.put("daily", sql.list("""
                SELECT d::date AS day,
                       (SELECT count(*) FROM click_events e WHERE e.promoter_user_id = :u AND e.click_day = d::date) AS clicks,
                       (SELECT count(*) FROM click_events e WHERE e.promoter_user_id = :u AND e.click_day = d::date AND e.qualified) AS qualified
                FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY 1""", Map.of("u", u)));
        m.put("minimumPayoutPaise", Long.parseLong(String.valueOf(sql.one("SELECT value FROM platform_settings WHERE key = 'payout.minimum_paise'", Map.of()).get("value"))));
        return m;
    }

    public record ApplyRequest(@Size(max = 1000) String pitch, boolean disclosureAccepted) {}

    @PostMapping("/campaigns/{id}/applications")
    @PreAuthorize("hasRole('PROMOTER')")
    @ResponseStatus(HttpStatus.CREATED)
    public CampaignApplication apply(@PathVariable UUID id, @Valid @RequestBody ApplyRequest req) {
        if (!req.disclosureAccepted())
            throw com.promora.common.ApiException.unprocessable("DISCLOSURE_REQUIRED", "Confirm that you will label your posts as advertising");
        return applications.apply(id, req.pitch());
    }

    @GetMapping("/promoter/applications")
    @PreAuthorize("hasRole('PROMOTER')")
    public PageResponse<Map<String, Object>> myApplications(@RequestParam(required = false) String status, @RequestParam(required = false) Integer page,
                                                            @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        p.put("u", Current.user().id());
        p.put("base", props.apiUrl());
        String where = """
                FROM campaign_applications a JOIN campaigns c ON c.id = a.campaign_id JOIN advertiser_profiles ad ON ad.id = c.advertiser_id
                LEFT JOIN tracking_links l ON l.application_id = a.id WHERE a.user_id = :u""";
        if (status != null && !status.isBlank()) { where += " AND a.status = :status"; p.put("status", status); }
        return sql.page("""
                SELECT a.id, a.status, a.pitch, a.decision_note, a.created_at, a.decided_at, c.id AS campaign_id, c.title, c.status AS campaign_status,
                       c.reward_type, c.reward_paise, c.promo_instructions, c.disclosure_text, ad.business_name,
                       l.code AS tracking_code, CASE WHEN l.code IS NOT NULL AND l.active THEN :base || '/r/' || l.code END AS tracking_url,
                       (SELECT count(*) FROM click_events e WHERE e.tracking_link_id = l.id) AS clicks,
                       (SELECT count(*) FROM click_events e WHERE e.tracking_link_id = l.id AND e.qualified) AS qualified_clicks,
                       (SELECT count(*) FROM conversion_events v WHERE v.tracking_link_id = l.id AND v.status = 'VERIFIED') AS conversions,
                       (SELECT coalesce(sum(cm.amount_paise), 0) FROM commissions cm JOIN conversion_events v ON v.id = cm.conversion_event_id
                          WHERE v.tracking_link_id = l.id AND cm.status <> 'REVERSED') AS earned_paise""",
                where, "a.created_at DESC", p, page, size);
    }

    @DeleteMapping("/promoter/applications/{id}")
    @PreAuthorize("hasRole('PROMOTER')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void withdraw(@PathVariable UUID id) { applications.withdraw(id); }

    public record DecisionRequest(@Size(max = 500) String note) {}

    @PostMapping("/advertiser/applications/{id}/{decision:approve|reject|remove}")
    @PreAuthorize("hasRole('ADVERTISER')")
    public CampaignApplication decide(@PathVariable UUID id, @PathVariable String decision, @RequestBody(required = false) DecisionRequest req) {
        return applications.decide(id, decision, req == null ? null : req.note());
    }

    @GetMapping("/promoter/earnings")
    @PreAuthorize("hasRole('PROMOTER')")
    public Map<String, Object> earnings(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        UUID u = Current.user().id();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("balances", balances(u));
        m.put("commissions", sql.page("""
                SELECT cm.id, cm.amount_paise, cm.status, cm.hold_until, cm.created_at, cm.payout_request_id, c.title AS campaign_title, v.type AS conversion_type""",
                "FROM commissions cm JOIN campaigns c ON c.id = cm.campaign_id JOIN conversion_events v ON v.id = cm.conversion_event_id WHERE cm.promoter_user_id = :u",
                "cm.created_at DESC", Map.of("u", u), page, size));
        List<Map<String, Object>> payoutRows = sql.list("""
                SELECT id, amount_paise, upi_id, status, admin_note, paid_reference, created_at, decided_at
                FROM payout_requests WHERE promoter_user_id = :u ORDER BY created_at DESC LIMIT 50""", Map.of("u", u));
        m.put("payouts", payoutRows);
        return m;
    }

    @PostMapping("/promoter/payouts")
    @PreAuthorize("hasRole('PROMOTER')")
    @ResponseStatus(HttpStatus.CREATED)
    public PayoutRequest requestPayout(@RequestHeader("Idempotency-Key") @NotBlank @Size(min = 8, max = 80) String key) {
        return payouts.request(key);
    }
}
