package com.promora.marketplace;

import com.promora.analytics.EventService;
import com.promora.common.ApiException;
import com.promora.common.PageResponse;
import com.promora.common.Sql;
import com.promora.common.Util;
import com.promora.moderation.UserReport;
import com.promora.moderation.UserReportRepository;
import com.promora.notification.NotificationService;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import com.promora.subscription.SubscriptionPlan;
import com.promora.subscription.SubscriptionPlanRepository;
import com.promora.tracking.TrackingService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Read-only discovery endpoints and public forms. Only live, non-hidden records are ever returned here. */
@RestController
@RequestMapping("/api/v1/public")
@Tag(name = "Public")
public class PublicController {
    private static final String CAMPAIGN_COLUMNS = """
            SELECT c.id, c.title, c.slug, left(c.description, 220) AS summary, c.objective, c.geography, c.reward_type, c.reward_paise,
                   c.budget_paise, c.funded_paise, c.spent_paise, c.application_mode, c.featured, c.start_date, c.end_date, c.created_at,
                   cat.name AS category_name, cat.slug AS category_slug, cat.icon AS category_icon,
                   ad.business_name, ad.slug AS business_slug, ad.logo_url AS business_logo_url, ad.verification_status AS business_verification,
                   (SELECT url FROM campaign_assets a WHERE a.campaign_id = c.id ORDER BY sort_order LIMIT 1) AS image_url,
                   (SELECT count(*) FROM campaign_applications ap WHERE ap.campaign_id = c.id AND ap.status = 'APPROVED') AS promoters""";
    private static final String CAMPAIGN_FROM = """
            FROM campaigns c JOIN advertiser_profiles ad ON ad.id = c.advertiser_id
            LEFT JOIN campaign_categories cat ON cat.id = c.category_id WHERE c.status = 'ACTIVE'""";

    private final Sql sql;
    private final SubscriptionPlanRepository plans;
    private final TrackingService tracking;
    private final UserReportRepository reports;
    private final NotificationService notifications;
    private final EventService events;

    public PublicController(Sql sql, SubscriptionPlanRepository plans, TrackingService tracking, UserReportRepository reports,
                            NotificationService notifications, EventService events) {
        this.sql = sql; this.plans = plans; this.tracking = tracking; this.reports = reports; this.notifications = notifications; this.events = events;
    }

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        return sql.list("""
                SELECT cat.id, cat.name, cat.slug, cat.description, cat.icon,
                       (SELECT count(*) FROM campaigns c WHERE c.category_id = cat.id AND c.status = 'ACTIVE') AS active_campaigns
                FROM campaign_categories cat WHERE cat.active ORDER BY cat.sort_order, cat.name""", Map.of());
    }

    @GetMapping("/campaigns")
    public PageResponse<Map<String, Object>> campaigns(@RequestParam(required = false) String q, @RequestParam(required = false) String category,
                                                       @RequestParam(required = false) String objective, @RequestParam(required = false) String rewardType,
                                                       @RequestParam(required = false) String geography, @RequestParam(required = false) Long minReward,
                                                       @RequestParam(required = false) Long minBudget, @RequestParam(required = false) Long maxBudget,
                                                       @RequestParam(required = false) Boolean featured, @RequestParam(required = false) String sort,
                                                       @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        StringBuilder where = new StringBuilder(CAMPAIGN_FROM);
        Map<String, Object> p = new HashMap<>();
        if (q != null && !q.isBlank()) {
            where.append(" AND (to_tsvector('simple', c.title || ' ' || c.description) @@ plainto_tsquery('simple', :q) OR c.title ILIKE :like OR ad.business_name ILIKE :like)");
            p.put("q", q.trim());
            p.put("like", "%" + q.trim().replace("%", "").replace("_", "") + "%");
        }
        if (category != null && !category.isBlank()) { where.append(" AND cat.slug = :category"); p.put("category", category); }
        if (objective != null && !objective.isBlank()) { where.append(" AND c.objective = :objective"); p.put("objective", objective); }
        if (rewardType != null && !rewardType.isBlank()) { where.append(" AND c.reward_type = :rewardType"); p.put("rewardType", rewardType); }
        if (geography != null && !geography.isBlank()) { where.append(" AND c.geography ILIKE :geo"); p.put("geo", "%" + geography.trim().replace("%", "") + "%"); }
        if (minReward != null) { where.append(" AND c.reward_paise >= :minReward"); p.put("minReward", minReward); }
        if (minBudget != null) { where.append(" AND c.budget_paise >= :minBudget"); p.put("minBudget", minBudget); }
        if (maxBudget != null) { where.append(" AND c.budget_paise <= :maxBudget"); p.put("maxBudget", maxBudget); }
        if (Boolean.TRUE.equals(featured)) where.append(" AND c.featured");
        // Sort keys are whitelisted; user input never reaches ORDER BY.
        String order = switch (sort == null ? "" : sort) {
            case "reward" -> "c.reward_paise DESC, c.created_at DESC";
            case "budget" -> "c.budget_paise DESC, c.created_at DESC";
            case "ending" -> "c.end_date ASC NULLS LAST, c.created_at DESC";
            default -> "c.featured DESC, c.created_at DESC";
        };
        return sql.page(CAMPAIGN_COLUMNS, where.toString(), order, p, page, size);
    }

    @GetMapping("/campaigns/{id}")
    public Map<String, Object> campaign(@PathVariable UUID id) {
        Map<String, Object> c = sql.one(CAMPAIGN_COLUMNS + ", c.description, c.target_audience, c.promo_instructions, c.disclosure_text, c.landing_url " + CAMPAIGN_FROM + " AND c.id = :id", Map.of("id", id));
        if (c == null) throw ApiException.notFound("Campaign");
        c.put("images", sql.list("SELECT url, alt_text FROM campaign_assets WHERE campaign_id = :id ORDER BY sort_order", Map.of("id", id)));
        AuthUser user = Current.userOrNull();
        if (user != null)
            c.put("myApplication", sql.one("SELECT id, status FROM campaign_applications WHERE campaign_id = :id AND user_id = :u", Map.of("id", id, "u", user.id())));
        return c;
    }

    @GetMapping("/businesses")
    public PageResponse<Map<String, Object>> businesses(@RequestParam(required = false) String q, @RequestParam(required = false) String category,
                                                        @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        StringBuilder where = new StringBuilder("""
                FROM advertiser_profiles ad JOIN users u ON u.id = ad.user_id LEFT JOIN campaign_categories cat ON cat.id = ad.category_id
                WHERE NOT ad.hidden AND u.status = 'ACTIVE'""");
        Map<String, Object> p = new HashMap<>();
        if (q != null && !q.isBlank()) { where.append(" AND (ad.business_name ILIKE :like OR ad.description ILIKE :like)"); p.put("like", "%" + q.trim().replace("%", "") + "%"); }
        if (category != null && !category.isBlank()) { where.append(" AND cat.slug = :category"); p.put("category", category); }
        return sql.page("""
                SELECT ad.id, ad.business_name, ad.slug, left(ad.description, 200) AS summary, ad.logo_url, ad.city, ad.website, ad.verification_status,
                       cat.name AS category_name, cat.icon AS category_icon,
                       (SELECT count(*) FROM campaigns c WHERE c.advertiser_id = ad.id AND c.status = 'ACTIVE') AS active_campaigns""",
                where.toString(), "(ad.verification_status = 'VERIFIED') DESC, ad.created_at DESC", p, page, size);
    }

    @GetMapping("/businesses/{slug}")
    public Map<String, Object> business(@PathVariable String slug) {
        Map<String, Object> b = sql.one("""
                SELECT ad.id, ad.business_name, ad.slug, ad.description, ad.logo_url, ad.city, ad.website, ad.verification_status, ad.created_at,
                       cat.name AS category_name, cat.slug AS category_slug
                FROM advertiser_profiles ad JOIN users u ON u.id = ad.user_id LEFT JOIN campaign_categories cat ON cat.id = ad.category_id
                WHERE ad.slug = :slug AND NOT ad.hidden AND u.status = 'ACTIVE'""", Map.of("slug", slug));
        if (b == null) throw ApiException.notFound("Business");
        b.put("campaigns", sql.list(CAMPAIGN_COLUMNS + " " + CAMPAIGN_FROM + " AND ad.slug = :slug ORDER BY c.created_at DESC LIMIT 24", Map.of("slug", slug)));
        return b;
    }

    @GetMapping("/creators")
    public PageResponse<Map<String, Object>> creators(@RequestParam(required = false) String q, @RequestParam(required = false) Integer minAudience,
                                                      @RequestParam(required = false) String sort,
                                                      @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        StringBuilder where = new StringBuilder("FROM promoter_profiles pr JOIN users u ON u.id = pr.user_id WHERE NOT pr.hidden AND u.status = 'ACTIVE'");
        Map<String, Object> p = new HashMap<>();
        if (q != null && !q.isBlank()) {
            where.append(" AND (pr.display_name ILIKE :like OR pr.bio ILIKE :like OR pr.interests ILIKE :like)");
            p.put("like", "%" + q.trim().replace("%", "") + "%");
        }
        if (minAudience != null) { where.append(" AND pr.audience_size >= :minAudience"); p.put("minAudience", minAudience); }
        String order = "audience".equals(sort) ? "pr.audience_size DESC" : "(pr.verification_status = 'VERIFIED') DESC, pr.created_at DESC";
        return sql.page("""
                SELECT pr.id, pr.display_name, pr.slug, left(pr.bio, 200) AS summary, pr.audience_size, pr.interests, pr.languages, pr.verification_status,
                       pr.instagram_url, pr.youtube_url, pr.linkedin_url, pr.website_url""", where.toString(), order, p, page, size);
    }

    @GetMapping("/creators/{slug}")
    public Map<String, Object> creator(@PathVariable String slug) {
        Map<String, Object> c = sql.one("""
                SELECT pr.id, pr.display_name, pr.slug, pr.bio, pr.audience_size, pr.audience_description, pr.interests, pr.languages, pr.verification_status,
                       pr.instagram_url, pr.youtube_url, pr.linkedin_url, pr.website_url, pr.created_at,
                       (SELECT count(*) FROM campaign_applications a WHERE a.promoter_id = pr.id AND a.status = 'APPROVED') AS campaigns_joined
                FROM promoter_profiles pr JOIN users u ON u.id = pr.user_id WHERE pr.slug = :slug AND NOT pr.hidden AND u.status = 'ACTIVE'""", Map.of("slug", slug));
        if (c == null) throw ApiException.notFound("Creator");
        return c;
    }

    @GetMapping("/plans")
    public List<SubscriptionPlan> plans() { return plans.findByActiveTrueOrderBySortOrder(); }

    /** Live counts from the database. The website shows a figure only when it is greater than zero. */
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return sql.one("""
                SELECT (SELECT count(*) FROM campaigns WHERE status = 'ACTIVE') AS active_campaigns,
                       (SELECT count(*) FROM advertiser_profiles WHERE NOT hidden) AS businesses,
                       (SELECT count(*) FROM promoter_profiles WHERE NOT hidden) AS creators,
                       (SELECT count(*) FROM click_events WHERE qualified) AS qualified_clicks""", Map.of());
    }

    @GetMapping("/announcements")
    public List<Map<String, Object>> announcements() {
        return sql.list("SELECT id, title, body, created_at FROM announcements WHERE active ORDER BY created_at DESC LIMIT 3", Map.of());
    }

    @GetMapping("/policy")
    public Map<String, Object> policy() { return sql.one("SELECT value AS campaign_policy FROM platform_settings WHERE key = 'campaign.policy'", Map.of()); }

    @GetMapping("/search")
    public Map<String, Object> search(@RequestParam String q) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("campaigns", campaigns(q, null, null, null, null, null, null, null, null, null, 0, 6).items());
        m.put("businesses", businesses(q, null, 0, 6).items());
        m.put("creators", creators(q, null, null, 0, 6).items());
        m.put("categories", sql.list("SELECT name, slug, icon FROM campaign_categories WHERE active AND name ILIKE :like ORDER BY sort_order LIMIT 6",
                Map.of("like", "%" + q.trim().replace("%", "") + "%")));
        return m;
    }

    public record LeadBody(@NotBlank @Size(max = 16) String code, @NotBlank @Size(min = 2, max = 120) String name, @NotBlank @Email String email,
                           @Pattern(regexp = "^$|^[+0-9 -]{7,20}$", message = "Enter a valid phone number") String phone,
                           @AssertTrue(message = "Consent is required to share your details with the advertiser") boolean consent) {}

    @PostMapping("/leads")
    public Map<String, Object> lead(@Valid @RequestBody LeadBody body, HttpServletRequest request) {
        // The response does not reveal whether the lead was counted, so the form cannot be used to probe deduplication.
        tracking.recordLead(new TrackingService.LeadRequest(body.code(), body.name(), body.email(), body.phone()), Util.clientIp(request), request.getHeader("User-Agent"));
        return Map.of("received", true);
    }

    public record ReportBody(@NotBlank @Pattern(regexp = "CAMPAIGN|BUSINESS|CREATOR") String targetType, @NotNull UUID targetId,
                             @NotBlank @Pattern(regexp = "SPAM|SCAM|ILLEGAL|COPYRIGHT|MISLEADING|OTHER") String reason,
                             @Size(max = 2000) String details, @Email String email) {}

    @PostMapping("/reports")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> report(@Valid @RequestBody ReportBody body) {
        AuthUser user = Current.userOrNull();
        UserReport r = new UserReport();
        r.setReporterUserId(user == null ? null : user.id());
        r.setReporterEmail(user == null ? Util.blankToNull(body.email()) : user.email());
        r.setTargetType(body.targetType());
        r.setTargetId(body.targetId());
        r.setReason(body.reason());
        r.setDetails(Util.blankToNull(body.details()));
        reports.save(r);
        notifications.notifyStaff("content.moderate", "ADMIN_ALERT", "New " + body.reason().toLowerCase() + " report", body.targetType().toLowerCase(), "/admin/moderation");
        return Map.of("id", r.getId(), "received", true);
    }

    public record ContactBody(@NotBlank @Size(max = 120) String name, @NotBlank @Email String email, @NotBlank @Size(max = 200) String subject,
                              @NotBlank @Size(min = 10, max = 4000) String message) {}

    @PostMapping("/contact")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> contact(@Valid @RequestBody ContactBody body) {
        sql.update("INSERT INTO contact_messages (name, email, subject, message) VALUES (:n, :e, :s, :m)",
                Map.of("n", body.name(), "e", body.email(), "s", body.subject(), "m", body.message()));
        return Map.of("received", true);
    }

    public record EventBody(@NotBlank @Size(max = 60) String name, @Size(max = 64) String anonymousId, @Size(max = 300) String path,
                            Map<String, Object> properties, @Size(max = 100) String utmSource, @Size(max = 100) String utmMedium, @Size(max = 100) String utmCampaign) {}

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void event(@Valid @RequestBody EventBody body) {
        if (!EventService.CLIENT_EVENTS.contains(body.name())) throw ApiException.badRequest("UNKNOWN_EVENT", "Unknown event");
        AuthUser user = Current.userOrNull();
        events.track(body.name(), user == null ? null : user.id(), body.anonymousId(), body.properties(), body.path(), body.utmSource(), body.utmMedium(), body.utmCampaign());
    }
}
