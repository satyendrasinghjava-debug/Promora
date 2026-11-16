package com.promora.campaign;

import com.promora.common.ApiException;
import com.promora.common.PageResponse;
import com.promora.common.Sql;
import com.promora.security.Current;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/advertiser")
@PreAuthorize("hasRole('ADVERTISER')")
@Tag(name = "Advertiser")
public class CampaignController {
    private final CampaignService service;
    private final CampaignAssetRepository assets;
    private final Sql sql;

    public CampaignController(CampaignService service, CampaignAssetRepository assets, Sql sql) {
        this.service = service; this.assets = assets; this.sql = sql;
    }

    @GetMapping("/dashboard")
    public Map<String, Object> dashboard() {
        UUID u = Current.user().id();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("summary", sql.one("""
                SELECT count(*) AS total_campaigns,
                       count(*) FILTER (WHERE status = 'ACTIVE') AS active_campaigns,
                       count(*) FILTER (WHERE status = 'PENDING_REVIEW') AS pending_approvals,
                       coalesce(sum(spent_paise), 0) AS spent_paise,
                       coalesce(sum(funded_paise), 0) AS funded_paise
                FROM campaigns WHERE owner_user_id = :u""", Map.of("u", u)));
        m.put("performance", sql.one("""
                SELECT (SELECT count(*) FROM click_events e JOIN campaigns c ON c.id = e.campaign_id WHERE c.owner_user_id = :u) AS total_clicks,
                       (SELECT count(*) FROM click_events e JOIN campaigns c ON c.id = e.campaign_id WHERE c.owner_user_id = :u AND e.qualified) AS qualified_clicks,
                       (SELECT count(*) FROM conversion_events v JOIN campaigns c ON c.id = v.campaign_id WHERE c.owner_user_id = :u AND v.type = 'LEAD' AND v.status = 'VERIFIED') AS qualified_leads,
                       (SELECT count(*) FROM conversion_events v JOIN campaigns c ON c.id = v.campaign_id WHERE c.owner_user_id = :u AND v.status = 'VERIFIED') AS conversions""", Map.of("u", u)));
        m.put("daily", sql.list("""
                SELECT d::date AS day,
                       (SELECT count(*) FROM click_events e JOIN campaigns c ON c.id = e.campaign_id WHERE c.owner_user_id = :u AND e.click_day = d::date) AS clicks,
                       (SELECT count(*) FROM click_events e JOIN campaigns c ON c.id = e.campaign_id WHERE c.owner_user_id = :u AND e.click_day = d::date AND e.qualified) AS qualified
                FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY 1""", Map.of("u", u)));
        return m;
    }

    @GetMapping("/campaigns")
    public PageResponse<Map<String, Object>> list(@RequestParam(required = false) String status, @RequestParam(required = false) Integer page,
                                                  @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        p.put("u", Current.user().id());
        String where = "FROM campaigns c LEFT JOIN campaign_categories cat ON cat.id = c.category_id WHERE c.owner_user_id = :u";
        if (status != null && !status.isBlank()) { where += " AND c.status = :status"; p.put("status", status); }
        return sql.page("""
                SELECT c.id, c.title, c.slug, c.status, c.reward_type, c.reward_paise, c.budget_paise, c.funded_paise, c.spent_paise,
                       c.start_date, c.end_date, c.created_at, c.review_note, cat.name AS category_name,
                       (SELECT count(*) FROM click_events e WHERE e.campaign_id = c.id AND e.qualified) AS qualified_clicks,
                       (SELECT count(*) FROM campaign_applications a WHERE a.campaign_id = c.id AND a.status = 'PENDING') AS pending_applications,
                       (SELECT count(*) FROM campaign_applications a WHERE a.campaign_id = c.id AND a.status = 'APPROVED') AS promoters""",
                where, "c.created_at DESC", p, page, size);
    }

    private Map<String, Object> detail(Campaign c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("campaign", c);
        m.put("imageUrls", assets.findByCampaignIdOrderBySortOrder(c.getId()).stream().map(CampaignAsset::getUrl).toList());
        return m;
    }

    @PostMapping("/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> create(@Valid @RequestBody CampaignService.CampaignRequest req) { return detail(service.create(req)); }

    @GetMapping("/campaigns/{id}")
    public Map<String, Object> get(@PathVariable UUID id) {
        Campaign c = service.owned(id);
        Map<String, Object> m = detail(c);
        m.put("stats", sql.one("""
                SELECT (SELECT count(*) FROM click_events WHERE campaign_id = :c) AS clicks,
                       (SELECT count(*) FROM click_events WHERE campaign_id = :c AND qualified) AS qualified_clicks,
                       (SELECT count(*) FROM conversion_events WHERE campaign_id = :c AND type = 'LEAD' AND status = 'VERIFIED') AS leads,
                       (SELECT count(*) FROM campaign_applications WHERE campaign_id = :c AND status = 'APPROVED') AS promoters""", Map.of("c", id)));
        m.put("rejections", sql.list("""
                SELECT coalesce(reject_reason, 'QUALIFIED') AS reason, count(*) AS clicks FROM click_events WHERE campaign_id = :c GROUP BY 1 ORDER BY 2 DESC""", Map.of("c", id)));
        m.put("daily", sql.list("""
                SELECT d::date AS day,
                       (SELECT count(*) FROM click_events e WHERE e.campaign_id = :c AND e.click_day = d::date) AS clicks,
                       (SELECT count(*) FROM click_events e WHERE e.campaign_id = :c AND e.click_day = d::date AND e.qualified) AS qualified
                FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY 1""", Map.of("c", id)));
        m.put("transactions", sql.list("""
                SELECT id, type, amount_paise, base_paise, fee_paise, tax_paise, status, provider, created_at
                FROM transactions WHERE campaign_id = :c ORDER BY created_at DESC""", Map.of("c", id)));
        m.put("leads", "CPL".equals(c.getRewardType()) ? sql.list("""
                SELECT id, lead_name, lead_email, lead_phone, status, created_at FROM conversion_events
                WHERE campaign_id = :c AND type = 'LEAD' ORDER BY created_at DESC LIMIT 200""", Map.of("c", id)) : java.util.List.of());
        return m;
    }

    @PutMapping("/campaigns/{id}")
    public Map<String, Object> update(@PathVariable UUID id, @Valid @RequestBody CampaignService.CampaignRequest req) { return detail(service.update(id, req)); }

    @PostMapping("/campaigns/{id}/submit")
    public Map<String, Object> submit(@PathVariable UUID id) { return detail(service.submit(id)); }

    @PostMapping("/campaigns/{id}/{action:pause|resume|cancel|complete}")
    public Map<String, Object> transition(@PathVariable UUID id, @PathVariable String action) {
        String target = switch (action) {
            case "pause" -> CampaignStatus.PAUSED;
            case "resume" -> CampaignStatus.ACTIVE;
            case "cancel" -> CampaignStatus.CANCELLED;
            case "complete" -> CampaignStatus.COMPLETED;
            default -> throw ApiException.badRequest("BAD_ACTION", "Unknown action");
        };
        return detail(service.ownerTransition(id, target));
    }

    @GetMapping("/campaigns/{id}/applications")
    public PageResponse<Map<String, Object>> applications(@PathVariable UUID id, @RequestParam(required = false) String status,
                                                          @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        service.owned(id);
        Map<String, Object> p = new HashMap<>();
        p.put("c", id);
        String where = "FROM campaign_applications a JOIN promoter_profiles pr ON pr.id = a.promoter_id LEFT JOIN tracking_links l ON l.application_id = a.id WHERE a.campaign_id = :c";
        if (status != null && !status.isBlank()) { where += " AND a.status = :status"; p.put("status", status); }
        return sql.page("""
                SELECT a.id, a.status, a.pitch, a.created_at, a.decided_at, pr.display_name, pr.slug AS promoter_slug, pr.audience_size,
                       pr.verification_status, pr.instagram_url, pr.youtube_url,
                       (SELECT count(*) FROM click_events e WHERE e.tracking_link_id = l.id) AS clicks,
                       (SELECT count(*) FROM click_events e WHERE e.tracking_link_id = l.id AND e.qualified) AS qualified_clicks""",
                where, "a.created_at DESC", p, page, size);
    }
}
