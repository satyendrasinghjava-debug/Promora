package com.promora.analytics;

import com.promora.audit.AuditService;
import com.promora.common.ApiException;
import com.promora.common.Sql;
import com.promora.security.Current;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Admin reports, each computed from persisted events and business records, with CSV export. */
@RestController
@RequestMapping("/api/v1/admin/analytics")
@Tag(name = "Admin reports")
public class ReportController {
    private static final Map<String, String> REPORTS = Map.of(
            "acquisition", """
                SELECT d::date AS day,
                       (SELECT count(*) FROM analytics_events e WHERE e.name = 'landing_page_viewed' AND e.created_at::date = d::date) AS landing_page_views,
                       (SELECT count(*) FROM analytics_events e WHERE e.name = 'signup_started' AND e.created_at::date = d::date) AS signups_started,
                       (SELECT count(*) FROM users u WHERE u.created_at::date = d::date) AS registrations,
                       (SELECT count(*) FROM users u WHERE u.created_at::date = d::date AND u.email_verified) AS verified_registrations,
                       (SELECT count(*) FROM advertiser_profiles a WHERE a.created_at::date = d::date) AS new_advertisers,
                       (SELECT count(*) FROM promoter_profiles p WHERE p.created_at::date = d::date) AS new_promoters
                FROM generate_series(current_date - (:days - 1), current_date, interval '1 day') d ORDER BY 1 DESC""",
            "sources", """
                SELECT coalesce(utm_source, '(direct or unknown)') AS source, coalesce(utm_medium, '') AS medium, count(*) AS registrations,
                       count(*) FILTER (WHERE email_verified) AS verified
                FROM users WHERE created_at > now() - make_interval(days => :days) GROUP BY 1, 2 ORDER BY 3 DESC""",
            "revenue", """
                SELECT d::date AS day,
                       (SELECT coalesce(sum(base_paise), 0) FROM transactions t WHERE t.type = 'CAMPAIGN_FUNDING' AND t.status IN ('PAID','REFUNDED') AND t.created_at::date = d::date) AS campaign_funding_paise,
                       (SELECT coalesce(sum(fee_paise), 0) FROM transactions t WHERE t.type = 'CAMPAIGN_FUNDING' AND t.status IN ('PAID','REFUNDED') AND t.created_at::date = d::date) AS platform_fee_paise,
                       (SELECT coalesce(sum(base_paise), 0) FROM transactions t WHERE t.type = 'SUBSCRIPTION' AND t.status = 'PAID' AND t.created_at::date = d::date) AS subscription_paise,
                       (SELECT coalesce(sum(amount_paise), 0) FROM transactions t WHERE t.type = 'REFUND' AND t.created_at::date = d::date) AS refunds_paise,
                       (SELECT coalesce(sum(amount_paise), 0) FROM transactions t WHERE t.type = 'PAYOUT' AND t.created_at::date = d::date) AS payouts_paise
                FROM generate_series(current_date - (:days - 1), current_date, interval '1 day') d ORDER BY 1 DESC""",
            "campaigns", """
                SELECT c.title, c.status, ad.business_name, c.reward_type, c.reward_paise, c.budget_paise, c.funded_paise, c.spent_paise,
                       (SELECT count(*) FROM campaign_applications a WHERE a.campaign_id = c.id AND a.status = 'APPROVED') AS promoters,
                       (SELECT count(*) FROM click_events e WHERE e.campaign_id = c.id) AS clicks,
                       (SELECT count(*) FROM click_events e WHERE e.campaign_id = c.id AND e.qualified) AS qualified_clicks,
                       (SELECT count(*) FROM conversion_events v WHERE v.campaign_id = c.id AND v.status = 'VERIFIED') AS conversions,
                       c.created_at
                FROM campaigns c JOIN advertiser_profiles ad ON ad.id = c.advertiser_id
                WHERE c.created_at > now() - make_interval(days => :days) ORDER BY c.created_at DESC""",
            "conversions", """
                SELECT d::date AS day,
                       (SELECT count(*) FROM click_events e WHERE e.click_day = d::date) AS clicks,
                       (SELECT count(*) FROM click_events e WHERE e.click_day = d::date AND e.qualified) AS qualified_clicks,
                       (SELECT count(*) FROM click_events e WHERE e.click_day = d::date AND NOT e.qualified) AS rejected_clicks,
                       (SELECT count(*) FROM conversion_events v WHERE v.created_at::date = d::date AND v.type = 'LEAD' AND v.status = 'VERIFIED') AS leads,
                       (SELECT coalesce(sum(cm.amount_paise), 0) FROM commissions cm WHERE cm.created_at::date = d::date AND cm.status <> 'REVERSED') AS commissions_paise
                FROM generate_series(current_date - (:days - 1), current_date, interval '1 day') d ORDER BY 1 DESC""",
            "retention", """
                SELECT 'Advertisers with at least one campaign' AS metric, count(DISTINCT owner_user_id) AS value FROM campaigns
                UNION ALL SELECT 'Advertisers with two or more campaigns', count(*) FROM (SELECT owner_user_id FROM campaigns GROUP BY 1 HAVING count(*) >= 2) x
                UNION ALL SELECT 'Promoters with at least one qualified click', count(DISTINCT promoter_user_id) FROM click_events WHERE qualified
                UNION ALL SELECT 'Promoters active in two or more distinct weeks', count(*) FROM
                    (SELECT promoter_user_id FROM click_events WHERE qualified GROUP BY 1 HAVING count(DISTINCT date_trunc('week', created_at)) >= 2) y
                UNION ALL SELECT 'Users who signed in during the last 7 days', count(*) FROM users WHERE last_login_at > now() - interval '7 days'
                UNION ALL SELECT 'Users who signed in during the last 30 days', count(*) FROM users WHERE last_login_at > now() - interval '30 days'
                UNION ALL SELECT 'Approved campaigns', count(*) FROM campaigns WHERE approved_at IS NOT NULL
                UNION ALL SELECT 'Approved campaigns with 10 or more qualified clicks or a verified lead', count(*) FROM campaigns c WHERE c.approved_at IS NOT NULL AND (
                    (SELECT count(*) FROM click_events e WHERE e.campaign_id = c.id AND e.qualified) >= 10
                    OR EXISTS (SELECT 1 FROM conversion_events v WHERE v.campaign_id = c.id AND v.type = 'LEAD' AND v.status = 'VERIFIED'))""",
            "events", """
                SELECT name AS event, count(*) AS occurrences, count(DISTINCT coalesce(user_id::text, anonymous_id)) AS distinct_actors, max(created_at) AS last_seen
                FROM analytics_events WHERE created_at > now() - make_interval(days => :days) GROUP BY 1 ORDER BY 2 DESC""");

    private final Sql sql;
    private final AuditService audit;

    public ReportController(Sql sql, AuditService audit) { this.sql = sql; this.audit = audit; }

    @GetMapping("/{type}")
    @PreAuthorize("hasAuthority('report.view')")
    public ResponseEntity<?> report(@PathVariable String type, @RequestParam(defaultValue = "30") int days, @RequestParam(required = false) String format) {
        String query = REPORTS.get(type);
        if (query == null) throw ApiException.notFound("Report");
        int d = Math.max(1, Math.min(days, 365));
        List<Map<String, Object>> rows = sql.list(query, Map.of("days", d));
        if (!"csv".equalsIgnoreCase(format)) return ResponseEntity.ok(Map.of("type", type, "days", d, "rows", rows));
        audit.log(Current.user(), "REPORT_EXPORTED", "REPORT", type, d + " days");
        return ResponseEntity.ok().contentType(new MediaType("text", "csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"promora-" + type + "-report.csv\"").body(toCsv(rows));
    }

    static String toCsv(List<Map<String, Object>> rows) {
        if (rows.isEmpty()) return "";
        StringBuilder sb = new StringBuilder(String.join(",", rows.get(0).keySet())).append("\n");
        for (Map<String, Object> row : rows) {
            sb.append(String.join(",", row.values().stream().map(ReportController::cell).toList())).append("\n");
        }
        return sb.toString();
    }

    /** Quotes every text cell and neutralises leading formula characters so exports are safe to open in a spreadsheet. */
    static String cell(Object v) {
        if (v == null) return "";
        if (v instanceof Number) return v.toString();
        String s = v.toString();
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0) s = "'" + s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
