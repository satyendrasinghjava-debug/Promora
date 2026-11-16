package com.promora.admin;

import com.promora.audit.AuditService;
import com.promora.campaign.Category;
import com.promora.campaign.CategoryRepository;
import com.promora.commission.CommissionService;
import com.promora.common.ApiException;
import com.promora.common.PageResponse;
import com.promora.common.Sql;
import com.promora.common.Util;
import com.promora.payment.PaymentService;
import com.promora.payout.PayoutService;
import com.promora.referral.ReferralService;
import com.promora.security.Current;
import com.promora.subscription.SubscriptionPlan;
import com.promora.subscription.SubscriptionPlanRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Admin API. The security filter chain already requires the 'admin.access' authority for /api/v1/admin/**;
 * every method additionally names the specific permission it needs.
 */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Admin")
public class AdminController {
    private final Sql sql;
    private final AdminActions actions;
    private final CommissionService commissions;
    private final PayoutService payouts;
    private final PaymentService payments;
    private final ReferralService referrals;
    private final CategoryRepository categories;
    private final SubscriptionPlanRepository plans;
    private final AuditService audit;

    public AdminController(Sql sql, AdminActions actions, CommissionService commissions, PayoutService payouts, PaymentService payments,
                           ReferralService referrals, CategoryRepository categories, SubscriptionPlanRepository plans, AuditService audit) {
        this.sql = sql; this.actions = actions; this.commissions = commissions; this.payouts = payouts; this.payments = payments;
        this.referrals = referrals; this.categories = categories; this.plans = plans; this.audit = audit;
    }

    public record ReasonBody(@Size(max = 1000) String reason) {}
    private static String reason(ReasonBody b) { return b == null ? null : b.reason(); }
    private static String like(String q) { return "%" + q.trim().replace("%", "").replace("_", "") + "%"; }

    // ---------------------------------------------------------------- dashboard
    @GetMapping("/dashboard")
    @PreAuthorize("hasAuthority('admin.access')")
    public Map<String, Object> dashboard() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("totals", sql.one("""
                SELECT (SELECT count(*) FROM users) AS total_users,
                       (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days') AS new_registrations_7d,
                       (SELECT count(*) FROM advertiser_profiles) AS advertisers,
                       (SELECT count(*) FROM promoter_profiles) AS promoters,
                       (SELECT count(*) FROM campaigns WHERE status = 'ACTIVE') AS active_campaigns,
                       (SELECT count(*) FROM campaigns WHERE status = 'PENDING_REVIEW') AS pending_campaigns,
                       (SELECT count(*) FROM campaigns WHERE status IN ('PENDING_REVIEW','CHANGES_REQUESTED')) AS campaigns_under_review,
                       (SELECT count(*) FROM transactions) AS total_transactions,
                       (SELECT coalesce(sum(base_paise), 0) FROM transactions WHERE type = 'CAMPAIGN_FUNDING' AND status = 'PAID') AS campaign_funding_paise,
                       (SELECT coalesce(sum(fee_paise), 0) FROM transactions WHERE type = 'CAMPAIGN_FUNDING' AND status IN ('PAID','REFUNDED'))
                         + (SELECT coalesce(sum(base_paise), 0) FROM transactions WHERE type = 'SUBSCRIPTION' AND status = 'PAID') AS platform_revenue_paise,
                       (SELECT count(*) FROM payout_requests WHERE status IN ('REQUESTED','APPROVED')) AS pending_payouts,
                       (SELECT coalesce(sum(amount_paise), 0) FROM payout_requests WHERE status IN ('REQUESTED','APPROVED')) AS pending_payouts_paise,
                       (SELECT count(*) FROM referrals) AS referrals,
                       (SELECT count(*) FROM referral_rewards WHERE status = 'PENDING_APPROVAL') AS pending_referral_rewards,
                       (SELECT count(*) FROM risk_flags WHERE status <> 'RESOLVED') AS fraud_alerts,
                       (SELECT count(*) FROM user_reports WHERE status = 'OPEN') AS open_reports,
                       (SELECT count(*) FROM verification_requests WHERE status = 'PENDING') AS pending_verifications""", Map.of()));
        m.put("growth", sql.list("""
                SELECT d::date AS day,
                       (SELECT count(*) FROM users u WHERE u.created_at::date = d::date) AS registrations,
                       (SELECT count(*) FROM click_events e WHERE e.click_day = d::date AND e.qualified) AS qualified_clicks,
                       (SELECT coalesce(sum(t.base_paise), 0) FROM transactions t WHERE t.type = 'CAMPAIGN_FUNDING' AND t.status = 'PAID' AND t.created_at::date = d::date) AS funded_paise
                FROM generate_series(current_date - 29, current_date, interval '1 day') d ORDER BY 1""", Map.of()));
        return m;
    }

    // ---------------------------------------------------------------- users
    @GetMapping("/users")
    @PreAuthorize("hasAuthority('user.view')")
    public PageResponse<Map<String, Object>> users(@RequestParam(required = false) String q, @RequestParam(required = false) String role,
                                                   @RequestParam(required = false) String status, @RequestParam(required = false) Integer page,
                                                   @RequestParam(required = false) Integer size) {
        StringBuilder where = new StringBuilder("FROM users u WHERE TRUE");
        Map<String, Object> p = new HashMap<>();
        if (q != null && !q.isBlank()) { where.append(" AND (u.email ILIKE :like OR u.full_name ILIKE :like)"); p.put("like", like(q)); }
        if (status != null && !status.isBlank()) { where.append(" AND u.status = :status"); p.put("status", status); }
        if (role != null && !role.isBlank()) { where.append(" AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role_name = :role)"); p.put("role", role); }
        return sql.page("""
                SELECT u.id, u.email, u.full_name, u.status, u.email_verified, u.verified_badge, u.created_at, u.last_login_at,
                       (SELECT string_agg(r.role_name, ',' ORDER BY r.role_name) FROM user_roles r WHERE r.user_id = u.id) AS roles""",
                where.toString(), "u.created_at DESC", p, page, size);
    }

    @GetMapping("/users/{id}")
    @PreAuthorize("hasAuthority('user.view')")
    public Map<String, Object> user(@PathVariable UUID id) {
        Map<String, Object> u = sql.one("""
                SELECT u.id, u.email, u.full_name, u.status, u.email_verified, u.verified_badge, u.promo_credits_paise, u.created_at, u.last_login_at,
                       u.utm_source, u.utm_medium, u.utm_campaign,
                       (SELECT string_agg(r.role_name, ',' ORDER BY r.role_name) FROM user_roles r WHERE r.user_id = u.id) AS roles,
                       p.phone, p.city, p.state, p.profile_completed
                FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = :id""", Map.of("id", id));
        if (u == null) throw ApiException.notFound("User");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("user", u);
        m.put("advertiserProfile", sql.one("SELECT id, business_name, slug, verification_status, hidden FROM advertiser_profiles WHERE user_id = :id", Map.of("id", id)));
        m.put("promoterProfile", sql.one("SELECT id, display_name, slug, audience_size, verification_status, hidden FROM promoter_profiles WHERE user_id = :id", Map.of("id", id)));
        m.put("counts", sql.one("""
                SELECT (SELECT count(*) FROM campaigns WHERE owner_user_id = :id) AS campaigns,
                       (SELECT count(*) FROM campaign_applications WHERE user_id = :id) AS applications,
                       (SELECT count(*) FROM transactions WHERE user_id = :id) AS transactions,
                       (SELECT count(*) FROM risk_flags WHERE user_id = :id AND status <> 'RESOLVED') AS open_risk_flags""", Map.of("id", id)));
        m.put("activity", sql.list("""
                SELECT action, target_type, target_id, details, created_at, actor_email FROM audit_logs
                WHERE actor_user_id = :id OR (target_type = 'USER' AND target_id = :sid) ORDER BY created_at DESC LIMIT 50""", Map.of("id", id, "sid", id.toString())));
        return m;
    }

    @PostMapping("/users/{id}/{action:suspend|reactivate}")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> userStatus(@PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) ReasonBody body) {
        actions.setUserStatus(id, "suspend".equals(action), reason(body));
        return Map.of("ok", true);
    }

    @PostMapping("/users/{id}/{action:verify|unverify}")
    @PreAuthorize("hasAuthority('user.manage')")
    public Map<String, Object> userVerify(@PathVariable UUID id, @PathVariable String action) {
        actions.setVerifiedBadge(id, "verify".equals(action));
        return Map.of("ok", true);
    }

    public record RolesBody(@NotNull Set<String> roles) {}

    @PutMapping("/users/{id}/roles")
    @PreAuthorize("hasAuthority('user.roles')")
    public Map<String, Object> userRoles(@PathVariable UUID id, @Valid @RequestBody RolesBody body) {
        actions.setRoles(id, body.roles());
        return Map.of("ok", true);
    }

    // ---------------------------------------------------------------- campaigns
    @GetMapping("/campaigns")
    @PreAuthorize("hasAuthority('campaign.moderate')")
    public PageResponse<Map<String, Object>> campaigns(@RequestParam(required = false) String q, @RequestParam(required = false) String status,
                                                       @RequestParam(required = false) Boolean reported,
                                                       @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        StringBuilder where = new StringBuilder("FROM campaigns c JOIN advertiser_profiles ad ON ad.id = c.advertiser_id JOIN users u ON u.id = c.owner_user_id WHERE TRUE");
        Map<String, Object> p = new HashMap<>();
        if (q != null && !q.isBlank()) { where.append(" AND (c.title ILIKE :like OR ad.business_name ILIKE :like OR u.email ILIKE :like)"); p.put("like", like(q)); }
        if (status != null && !status.isBlank()) { where.append(" AND c.status = :status"); p.put("status", status); }
        if (Boolean.TRUE.equals(reported)) where.append(" AND EXISTS (SELECT 1 FROM user_reports r WHERE r.target_type = 'CAMPAIGN' AND r.target_id = c.id AND r.status = 'OPEN')");
        return sql.page("""
                SELECT c.id, c.title, c.status, c.reward_type, c.reward_paise, c.budget_paise, c.funded_paise, c.spent_paise, c.featured,
                       c.submitted_at, c.created_at, ad.business_name, u.email AS owner_email,
                       (SELECT count(*) FROM user_reports r WHERE r.target_type = 'CAMPAIGN' AND r.target_id = c.id AND r.status = 'OPEN') AS open_reports""",
                where.toString(), "(c.status = 'PENDING_REVIEW') DESC, c.submitted_at ASC NULLS LAST, c.created_at DESC", p, page, size);
    }

    @GetMapping("/campaigns/{id}")
    @PreAuthorize("hasAuthority('campaign.moderate')")
    public Map<String, Object> campaign(@PathVariable UUID id) {
        Map<String, Object> c = sql.one("""
                SELECT c.*, ad.business_name, ad.verification_status AS business_verification, u.email AS owner_email, cat.name AS category_name
                FROM campaigns c JOIN advertiser_profiles ad ON ad.id = c.advertiser_id JOIN users u ON u.id = c.owner_user_id
                LEFT JOIN campaign_categories cat ON cat.id = c.category_id WHERE c.id = :id""", Map.of("id", id));
        if (c == null) throw ApiException.notFound("Campaign");
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("campaign", c);
        m.put("images", sql.list("SELECT url FROM campaign_assets WHERE campaign_id = :id ORDER BY sort_order", Map.of("id", id)));
        m.put("history", sql.list("""
                SELECT a.action, a.reason, a.created_at, u.email AS admin_email FROM moderation_actions a JOIN users u ON u.id = a.admin_user_id
                WHERE a.target_type = 'CAMPAIGN' AND a.target_id = :id ORDER BY a.created_at DESC""", Map.of("id", id)));
        m.put("stats", sql.one("""
                SELECT (SELECT count(*) FROM click_events WHERE campaign_id = :id) AS clicks,
                       (SELECT count(*) FROM click_events WHERE campaign_id = :id AND qualified) AS qualified_clicks,
                       (SELECT count(*) FROM conversion_events WHERE campaign_id = :id AND status = 'VERIFIED') AS conversions,
                       (SELECT count(*) FROM campaign_applications WHERE campaign_id = :id AND status = 'APPROVED') AS promoters""", Map.of("id", id)));
        m.put("policy", sql.one("SELECT value FROM platform_settings WHERE key = 'campaign.policy'", Map.of()).get("value"));
        return m;
    }

    @PostMapping("/campaigns/{id}/{action:approve|reject|request-changes|pause|terminate|feature|unfeature}")
    @PreAuthorize("hasAuthority('campaign.moderate')")
    public Map<String, Object> moderate(@PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) ReasonBody body) {
        return Map.of("id", id, "status", actions.moderateCampaign(id, action, reason(body)).getStatus());
    }

    // ---------------------------------------------------------------- verification
    @GetMapping("/verifications")
    @PreAuthorize("hasAuthority('verification.review')")
    public PageResponse<Map<String, Object>> verifications(@RequestParam(required = false) String status, @RequestParam(required = false) Integer page,
                                                           @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM verification_requests v JOIN users u ON u.id = v.user_id LEFT JOIN advertiser_profiles ad ON ad.user_id = u.id LEFT JOIN promoter_profiles pr ON pr.user_id = u.id WHERE TRUE";
        if (status != null && !status.isBlank()) { where += " AND v.status = :status"; p.put("status", status); }
        return sql.page("""
                SELECT v.id, v.profile_type, v.note, v.document_url, v.status, v.decision_reason, v.created_at, v.decided_at, u.id AS user_id, u.email,
                       CASE WHEN v.profile_type = 'ADVERTISER' THEN ad.business_name ELSE pr.display_name END AS profile_name""",
                where, "(v.status = 'PENDING') DESC, v.created_at DESC", p, page, size);
    }

    @PostMapping("/verifications/{id}/{action:approve|reject}")
    @PreAuthorize("hasAuthority('verification.review')")
    public Map<String, Object> decideVerification(@PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) ReasonBody body) {
        actions.decideVerification(id, "approve".equals(action), reason(body));
        return Map.of("ok", true);
    }

    // ---------------------------------------------------------------- finance
    @GetMapping("/finance/summary")
    @PreAuthorize("hasAuthority('finance.view')")
    public Map<String, Object> financeSummary() {
        Map<String, Object> m = new LinkedHashMap<>(sql.one("""
                SELECT (SELECT coalesce(sum(amount_paise), 0) FROM transactions WHERE status = 'PAID' AND type IN ('CAMPAIGN_FUNDING','SUBSCRIPTION')) AS collected_paise,
                       (SELECT coalesce(sum(fee_paise), 0) FROM transactions WHERE type = 'CAMPAIGN_FUNDING' AND status IN ('PAID','REFUNDED')) AS platform_fees_paise,
                       (SELECT coalesce(sum(tax_paise), 0) FROM transactions WHERE status IN ('PAID','REFUNDED') AND type IN ('CAMPAIGN_FUNDING','SUBSCRIPTION')) AS tax_collected_paise,
                       (SELECT coalesce(sum(base_paise), 0) FROM transactions WHERE type = 'SUBSCRIPTION' AND status = 'PAID') AS subscription_revenue_paise,
                       (SELECT coalesce(sum(amount_paise), 0) FROM transactions WHERE type = 'REFUND') AS refunded_paise,
                       (SELECT coalesce(sum(amount_paise), 0) FROM commissions WHERE status <> 'REVERSED') AS creator_commission_paise,
                       (SELECT coalesce(sum(amount_paise), 0) FROM commissions WHERE status = 'PENDING') AS commission_pending_paise,
                       (SELECT coalesce(sum(amount_paise), 0) FROM commissions WHERE status = 'PAID') AS commission_paid_paise,
                       (SELECT coalesce(sum(funded_paise - spent_paise), 0) FROM campaigns) AS unspent_campaign_funds_paise""", Map.of()));
        m.put("payments", payments.config());
        return m;
    }

    @GetMapping("/finance/transactions")
    @PreAuthorize("hasAuthority('finance.view')")
    public PageResponse<Map<String, Object>> transactions(@RequestParam(required = false) String type, @RequestParam(required = false) String status,
                                                          @RequestParam(required = false) String q,
                                                          @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        StringBuilder where = new StringBuilder("FROM transactions t JOIN users u ON u.id = t.user_id LEFT JOIN campaigns c ON c.id = t.campaign_id WHERE TRUE");
        Map<String, Object> p = new HashMap<>();
        if (type != null && !type.isBlank()) { where.append(" AND t.type = :type"); p.put("type", type); }
        if (status != null && !status.isBlank()) { where.append(" AND t.status = :status"); p.put("status", status); }
        if (q != null && !q.isBlank()) { where.append(" AND (u.email ILIKE :like OR t.provider_order_id ILIKE :like OR c.title ILIKE :like)"); p.put("like", like(q)); }
        return sql.page("""
                SELECT t.id, t.type, t.amount_paise, t.base_paise, t.fee_paise, t.tax_paise, t.credit_paise, t.status, t.provider, t.provider_order_id,
                       t.provider_payment_id, t.description, t.created_at, u.email AS user_email, c.title AS campaign_title, c.status AS campaign_status""",
                where.toString(), "t.created_at DESC", p, page, size);
    }

    @PostMapping("/finance/transactions/{id}/refund")
    @PreAuthorize("hasAuthority('finance.manage')")
    public Map<String, Object> refund(@PathVariable UUID id, @RequestBody(required = false) ReasonBody body) {
        return Map.of("refundTransactionId", payments.refundUnspent(id, reason(body)).getId());
    }

    @GetMapping("/finance/commissions")
    @PreAuthorize("hasAuthority('finance.view')")
    public PageResponse<Map<String, Object>> commissionList(@RequestParam(required = false) String status, @RequestParam(required = false) Integer page,
                                                            @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM commissions cm JOIN users u ON u.id = cm.promoter_user_id JOIN campaigns c ON c.id = cm.campaign_id JOIN conversion_events v ON v.id = cm.conversion_event_id WHERE TRUE";
        if (status != null && !status.isBlank()) { where += " AND cm.status = :status"; p.put("status", status); }
        return sql.page("""
                SELECT cm.id, cm.amount_paise, cm.platform_fee_paise, cm.status, cm.hold_until, cm.created_at, cm.payout_request_id,
                       u.email AS promoter_email, c.title AS campaign_title, v.type AS conversion_type""", where, "cm.created_at DESC", p, page, size);
    }

    @PostMapping("/finance/commissions/{id}/{action:release|reverse}")
    @PreAuthorize("hasAuthority('finance.manage')")
    @Transactional
    public Map<String, Object> commissionDecision(@PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) ReasonBody body) {
        if ("reverse".equals(action) && (reason(body) == null || reason(body).isBlank())) throw ApiException.unprocessable("REASON_REQUIRED", "A reason is required for this action");
        String status = commissions.adminDecide(id, "reverse".equals(action)).getStatus();
        audit.log(Current.user(), "COMMISSION_" + action.toUpperCase(), "COMMISSION", id, reason(body));
        return Map.of("id", id, "status", status);
    }

    @GetMapping("/finance/payouts")
    @PreAuthorize("hasAuthority('finance.view')")
    public PageResponse<Map<String, Object>> payoutList(@RequestParam(required = false) String status, @RequestParam(required = false) Integer page,
                                                        @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM payout_requests pr JOIN users u ON u.id = pr.promoter_user_id WHERE TRUE";
        if (status != null && !status.isBlank()) { where += " AND pr.status = :status"; p.put("status", status); }
        return sql.page("""
                SELECT pr.id, pr.amount_paise, pr.upi_id, pr.status, pr.admin_note, pr.paid_reference, pr.created_at, pr.decided_at, u.email AS promoter_email, u.id AS user_id,
                       (SELECT count(*) FROM commissions c WHERE c.payout_request_id = pr.id) AS commissions,
                       (SELECT count(*) FROM risk_flags f WHERE f.user_id = u.id AND f.status <> 'RESOLVED') AS open_risk_flags""",
                where, "(pr.status IN ('REQUESTED','APPROVED')) DESC, pr.created_at DESC", p, page, size);
    }

    public record PayoutBody(@Size(max = 500) String note, @Size(max = 120) String reference) {}

    @PostMapping("/finance/payouts/{id}/{action:approve|reject|mark-paid}")
    @PreAuthorize("hasAuthority('finance.manage')")
    public Map<String, Object> payoutDecision(@PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) PayoutBody body) {
        return Map.of("id", id, "status", payouts.decide(id, action, body == null ? null : body.note(), body == null ? null : body.reference()).getStatus());
    }

    // ---------------------------------------------------------------- referrals
    @GetMapping("/referrals")
    @PreAuthorize("hasAuthority('referral.manage')")
    public PageResponse<Map<String, Object>> referralList(@RequestParam(required = false) String status, @RequestParam(required = false) Boolean suspicious,
                                                          @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM referrals r JOIN users a ON a.id = r.referrer_user_id JOIN users b ON b.id = r.referred_user_id LEFT JOIN referral_rewards rw ON rw.referral_id = r.id WHERE TRUE";
        if (status != null && !status.isBlank()) { where += " AND r.status = :status"; p.put("status", status); }
        if (Boolean.TRUE.equals(suspicious)) where += " AND r.suspicious";
        return sql.page("""
                SELECT r.id, r.code, r.status, r.referred_type, r.suspicious, r.suspicious_reason, r.created_at, r.activated_at,
                       a.email AS referrer_email, b.email AS referred_email, rw.id AS reward_id, rw.amount_paise AS reward_paise, rw.status AS reward_status, rw.note AS reward_note""",
                where, "(rw.status = 'PENDING_APPROVAL') DESC NULLS LAST, r.created_at DESC", p, page, size);
    }

    @PostMapping("/referrals/rewards/{id}/{action:approve|reject}")
    @PreAuthorize("hasAuthority('referral.manage')")
    @Transactional
    public Map<String, Object> rewardDecision(@PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) ReasonBody body) {
        if ("reject".equals(action) && (reason(body) == null || reason(body).isBlank())) throw ApiException.unprocessable("REASON_REQUIRED", "A reason is required for this action");
        referrals.decideReward(id, "approve".equals(action), reason(body), Current.user());
        audit.log(Current.user(), "REFERRAL_REWARD_" + action.toUpperCase(), "REFERRAL_REWARD", id, reason(body));
        return Map.of("ok", true);
    }

    // ---------------------------------------------------------------- fraud
    @GetMapping("/risk-flags")
    @PreAuthorize("hasAuthority('fraud.manage')")
    public PageResponse<Map<String, Object>> riskFlags(@RequestParam(required = false) String status, @RequestParam(required = false) String type,
                                                       @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM risk_flags f LEFT JOIN users u ON u.id = f.user_id WHERE TRUE";
        if (status != null && !status.isBlank()) { where += " AND f.status = :status"; p.put("status", status); }
        if (type != null && !type.isBlank()) { where += " AND f.type = :type"; p.put("type", type); }
        return sql.page("""
                SELECT f.id, f.type, f.severity, f.details, f.status, f.subject_type, f.subject_id, f.resolution_note, f.created_at, f.resolved_at,
                       u.id AS user_id, u.email AS user_email""", where, "(f.status <> 'RESOLVED') DESC, f.created_at DESC", p, page, size);
    }

    public record RiskBody(@NotBlank String status, @Size(max = 1000) String note) {}

    @PostMapping("/risk-flags/{id}")
    @PreAuthorize("hasAuthority('fraud.manage')")
    public Map<String, Object> riskUpdate(@PathVariable UUID id, @Valid @RequestBody RiskBody body) {
        actions.updateRiskFlag(id, body.status(), body.note());
        return Map.of("ok", true);
    }

    @GetMapping("/fraud/click-patterns")
    @PreAuthorize("hasAuthority('fraud.manage')")
    public List<Map<String, Object>> clickPatterns() {
        return sql.list("""
                SELECT u.email AS promoter_email, c.title AS campaign_title, count(*) AS clicks, count(*) FILTER (WHERE e.qualified) AS qualified,
                       count(*) FILTER (WHERE e.reject_reason = 'DUPLICATE') AS duplicates, count(*) FILTER (WHERE e.reject_reason = 'BOT') AS bots,
                       count(*) FILTER (WHERE e.reject_reason IN ('VELOCITY','SELF_CLICK')) AS suspicious, count(DISTINCT e.ip_hash) AS distinct_ips
                FROM click_events e JOIN users u ON u.id = e.promoter_user_id JOIN campaigns c ON c.id = e.campaign_id
                WHERE e.created_at > now() - interval '30 days' GROUP BY u.email, c.title
                HAVING count(*) FILTER (WHERE NOT e.qualified) > 0 ORDER BY count(*) FILTER (WHERE NOT e.qualified) DESC LIMIT 50""", Map.of());
    }

    // ---------------------------------------------------------------- content moderation
    @GetMapping("/moderation/reports")
    @PreAuthorize("hasAuthority('content.moderate')")
    public PageResponse<Map<String, Object>> reports(@RequestParam(required = false) String status, @RequestParam(required = false) String reason,
                                                     @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM user_reports r WHERE TRUE";
        if (status != null && !status.isBlank()) { where += " AND r.status = :status"; p.put("status", status); }
        if (reason != null && !reason.isBlank()) { where += " AND r.reason = :reason"; p.put("reason", reason); }
        return sql.page("""
                SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.resolution, r.reporter_email, r.created_at, r.resolved_at,
                       CASE r.target_type WHEN 'CAMPAIGN' THEN (SELECT title FROM campaigns WHERE id = r.target_id)
                            WHEN 'BUSINESS' THEN (SELECT business_name FROM advertiser_profiles WHERE id = r.target_id)
                            ELSE (SELECT display_name FROM promoter_profiles WHERE id = r.target_id) END AS target_name""",
                where, "(r.status = 'OPEN') DESC, r.created_at DESC", p, page, size);
    }

    public record ResolveBody(@NotBlank @Pattern(regexp = "DISMISS|RESOLVE|REMOVE_CONTENT") String action, @NotBlank @Size(max = 500) String resolution) {}

    @PostMapping("/moderation/reports/{id}/resolve")
    @PreAuthorize("hasAuthority('content.moderate')")
    public Map<String, Object> resolveReport(@PathVariable UUID id, @Valid @RequestBody ResolveBody body) {
        actions.resolveReport(id, body.action(), body.resolution());
        return Map.of("ok", true);
    }

    @PostMapping("/moderation/content/{type:BUSINESS|CREATOR|CAMPAIGN}/{id}/{action:remove|restore}")
    @PreAuthorize("hasAuthority('content.moderate')")
    public Map<String, Object> content(@PathVariable String type, @PathVariable UUID id, @PathVariable String action, @RequestBody(required = false) ReasonBody body) {
        actions.setContentHidden(type, id, "remove".equals(action), reason(body));
        return Map.of("ok", true);
    }

    @GetMapping("/moderation/history")
    @PreAuthorize("hasAuthority('content.moderate')")
    public PageResponse<Map<String, Object>> moderationHistory(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return sql.page("SELECT a.id, a.target_type, a.target_id, a.action, a.reason, a.created_at, u.email AS admin_email",
                "FROM moderation_actions a JOIN users u ON u.id = a.admin_user_id", "a.created_at DESC", new HashMap<>(), page, size);
    }

    // ---------------------------------------------------------------- settings
    @GetMapping("/settings")
    @PreAuthorize("hasAuthority('admin.access')")
    public Map<String, Object> settings() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("settings", sql.list("SELECT key, value, description, updated_at FROM platform_settings ORDER BY key", Map.of()));
        m.put("categories", sql.list("SELECT id, name, slug, description, icon, active, sort_order FROM campaign_categories ORDER BY sort_order, name", Map.of()));
        m.put("plans", plans.findAll().stream().sorted(Comparator.comparingInt(SubscriptionPlan::getSortOrder)).toList());
        m.put("announcements", sql.list("SELECT id, title, body, active, created_at FROM announcements ORDER BY created_at DESC LIMIT 50", Map.of()));
        return m;
    }

    public record SettingBody(@NotBlank @Size(max = 4000) String value) {}

    @PutMapping("/settings/{key}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @Transactional
    public Map<String, Object> setSetting(@PathVariable String key, @Valid @RequestBody SettingBody body) {
        Map<String, Object> existing = sql.one("SELECT value FROM platform_settings WHERE key = :k", Map.of("k", key));
        if (existing == null) throw ApiException.notFound("Setting");
        boolean numeric = key.endsWith("_bps") || key.endsWith("_paise") || key.endsWith("_days") || key.endsWith("_per_month") || key.endsWith("_per_hour");
        if (numeric) {
            try { if (Long.parseLong(body.value().trim()) < 0) throw new NumberFormatException(); }
            catch (NumberFormatException e) { throw ApiException.unprocessable("BAD_VALUE", "This setting must be a whole number of zero or more"); }
            if (key.endsWith("_bps") && Long.parseLong(body.value().trim()) > 10000) throw ApiException.unprocessable("BAD_VALUE", "Basis points cannot exceed 10000");
        }
        sql.update("UPDATE platform_settings SET value = :v, updated_by = :u, updated_at = now() WHERE key = :k", Map.of("v", body.value().trim(), "u", Current.user().id(), "k", key));
        audit.log(Current.user(), "SETTING_CHANGED", "SETTING", key, existing.get("value") + " -> " + body.value().trim());
        return Map.of("ok", true);
    }

    public record CategoryBody(@NotBlank @Size(max = 80) String name, @Size(max = 300) String description, @Size(max = 40) String icon,
                               boolean active, @Min(0) @Max(999) int sortOrder) {}

    @PostMapping("/categories")
    @PreAuthorize("hasAuthority('settings.manage')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Category createCategory(@Valid @RequestBody CategoryBody body) {
        Category c = new Category();
        String slug = Util.slugify(body.name());
        if (categories.findBySlug(slug).isPresent()) throw ApiException.conflict("DUPLICATE", "A category with this name already exists");
        c.setSlug(slug);
        applyCategory(c, body);
        audit.log(Current.user(), "CATEGORY_CREATED", "CATEGORY", c.getId(), body.name());
        return c;
    }

    @PutMapping("/categories/{id}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @Transactional
    public Category updateCategory(@PathVariable UUID id, @Valid @RequestBody CategoryBody body) {
        Category c = categories.findById(id).orElseThrow(() -> ApiException.notFound("Category"));
        applyCategory(c, body);
        audit.log(Current.user(), "CATEGORY_UPDATED", "CATEGORY", id, body.name());
        return c;
    }

    private void applyCategory(Category c, CategoryBody body) {
        c.setName(body.name().trim());
        c.setDescription(Util.blankToNull(body.description()));
        if (Util.blankToNull(body.icon()) != null) c.setIcon(body.icon().trim());
        c.setActive(body.active());
        c.setSortOrder(body.sortOrder());
        categories.save(c);
    }

    public record PlanBody(@NotBlank @Size(max = 60) String name, @Min(0) long pricePaise, @Min(1) int maxActiveCampaigns,
                           @Min(0) @Max(10000) int platformFeeBps, @Size(max = 1000) String features, boolean highlighted, boolean active) {}

    @PutMapping("/plans/{id}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @Transactional
    public SubscriptionPlan updatePlan(@PathVariable UUID id, @Valid @RequestBody PlanBody body) {
        SubscriptionPlan p = plans.findById(id).orElseThrow(() -> ApiException.notFound("Plan"));
        p.setName(body.name().trim());
        p.setPricePaise(body.pricePaise());
        p.setMaxActiveCampaigns(body.maxActiveCampaigns());
        p.setPlatformFeeBps(body.platformFeeBps());
        p.setFeatures(body.features() == null ? "" : body.features());
        p.setHighlighted(body.highlighted());
        p.setActive(body.active());
        plans.save(p);
        audit.log(Current.user(), "PLAN_UPDATED", "PLAN", id, p.getCode() + " price=" + body.pricePaise() + " feeBps=" + body.platformFeeBps());
        return p;
    }

    public record AnnouncementBody(@NotBlank @Size(max = 160) String title, @NotBlank @Size(max = 1000) String body) {}

    @PostMapping("/announcements")
    @PreAuthorize("hasAuthority('settings.manage')")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> announce(@Valid @RequestBody AnnouncementBody body) {
        sql.update("INSERT INTO announcements (title, body) VALUES (:t, :b)", Map.of("t", body.title().trim(), "b", body.body().trim()));
        audit.log(Current.user(), "ANNOUNCEMENT_PUBLISHED", "ANNOUNCEMENT", null, body.title());
        return Map.of("ok", true);
    }

    @PostMapping("/announcements/{id}/{action:activate|deactivate}")
    @PreAuthorize("hasAuthority('settings.manage')")
    @Transactional
    public Map<String, Object> toggleAnnouncement(@PathVariable UUID id, @PathVariable String action) {
        if (sql.update("UPDATE announcements SET active = :a WHERE id = :id", Map.of("a", "activate".equals(action), "id", id)) == 0) throw ApiException.notFound("Announcement");
        audit.log(Current.user(), "ANNOUNCEMENT_" + action.toUpperCase(), "ANNOUNCEMENT", id, null);
        return Map.of("ok", true);
    }

    // ---------------------------------------------------------------- audit and operations
    @GetMapping("/audit-logs")
    @PreAuthorize("hasAuthority('audit.view')")
    public PageResponse<Map<String, Object>> auditLogs(@RequestParam(required = false) String q, @RequestParam(required = false) Integer page,
                                                       @RequestParam(required = false) Integer size) {
        Map<String, Object> p = new HashMap<>();
        String where = "FROM audit_logs a WHERE TRUE";
        if (q != null && !q.isBlank()) { where += " AND (a.action ILIKE :like OR a.actor_email ILIKE :like OR a.target_id ILIKE :like)"; p.put("like", like(q)); }
        return sql.page("SELECT a.id, a.actor_email, a.action, a.target_type, a.target_id, a.details, a.ip, a.created_at", where, "a.created_at DESC", p, page, size);
    }

    @GetMapping("/email-log")
    @PreAuthorize("hasAuthority('admin.access')")
    public PageResponse<Map<String, Object>> emailLog(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        // Bodies can contain single-use links, so only metadata is listed.
        return sql.page("SELECT id, to_email, subject, transport, created_at", "FROM email_log", "created_at DESC", new HashMap<>(), page, size);
    }

    @GetMapping("/contact-messages")
    @PreAuthorize("hasAuthority('content.moderate')")
    public PageResponse<Map<String, Object>> contactMessages(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return sql.page("SELECT id, name, email, subject, message, created_at", "FROM contact_messages", "created_at DESC", new HashMap<>(), page, size);
    }
}
