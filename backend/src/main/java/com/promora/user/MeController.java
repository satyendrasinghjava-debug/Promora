package com.promora.user;

import com.promora.advertiser.AdvertiserProfile;
import com.promora.advertiser.AdvertiserProfileRepository;
import com.promora.analytics.EventService;
import com.promora.auth.AuthDtos.ChangePasswordRequest;
import com.promora.auth.AuthService;
import com.promora.campaign.CategoryRepository;
import com.promora.common.ApiException;
import com.promora.common.PageResponse;
import com.promora.common.Sql;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import com.promora.moderation.VerificationRequest;
import com.promora.moderation.VerificationRequestRepository;
import com.promora.notification.NotificationService;
import com.promora.promoter.PromoterProfile;
import com.promora.promoter.PromoterProfileRepository;
import com.promora.referral.ReferralService;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "My account")
public class MeController {
    private static final String URL_RULE = "^$|^https://[^\\s]{3,290}$";
    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final AdvertiserProfileRepository advertisers;
    private final PromoterProfileRepository promoters;
    private final CategoryRepository categories;
    private final VerificationRequestRepository verifications;
    private final UserService userService;
    private final AuthService auth;
    private final ReferralService referrals;
    private final NotificationService notifications;
    private final EventService events;
    private final PromoraProperties props;
    private final Sql sql;

    public MeController(UserRepository users, UserProfileRepository profiles, AdvertiserProfileRepository advertisers, PromoterProfileRepository promoters,
                        CategoryRepository categories, VerificationRequestRepository verifications, UserService userService, AuthService auth,
                        ReferralService referrals, NotificationService notifications, EventService events, PromoraProperties props, Sql sql) {
        this.users = users; this.profiles = profiles; this.advertisers = advertisers; this.promoters = promoters; this.categories = categories;
        this.verifications = verifications; this.userService = userService; this.auth = auth; this.referrals = referrals;
        this.notifications = notifications; this.events = events; this.props = props; this.sql = sql;
    }

    private User me() { return users.findById(Current.user().id()).orElseThrow(); }

    @GetMapping
    public Map<String, Object> get() { return userService.describe(me()); }

    public record ProfileRequest(@NotBlank @Size(min = 2, max = 120) String fullName,
                                 @Pattern(regexp = "^$|^[+0-9 -]{7,20}$", message = "Enter a valid phone number") String phone,
                                 @Size(max = 80) String city, @Size(max = 80) String state, @Size(max = 1000) String bio,
                                 boolean marketingConsent) {}

    @PutMapping("/profile")
    @Transactional
    public Map<String, Object> updateProfile(@Valid @RequestBody ProfileRequest req) {
        User u = me();
        u.setFullName(req.fullName().trim());
        u.setUpdatedAt(Instant.now());
        users.save(u);
        UserProfile p = profiles.findById(u.getId()).orElseGet(() -> { UserProfile n = new UserProfile(); n.setUserId(u.getId()); return n; });
        boolean wasComplete = p.isProfileCompleted();
        p.setPhone(Util.blankToNull(req.phone()));
        p.setCity(Util.blankToNull(req.city()));
        p.setState(Util.blankToNull(req.state()));
        p.setBio(Util.blankToNull(req.bio()));
        p.setMarketingConsent(req.marketingConsent());
        p.setProfileCompleted(p.getCity() != null && p.getPhone() != null);
        p.setUpdatedAt(Instant.now());
        profiles.save(p);
        if (!wasComplete && p.isProfileCompleted()) events.track("profile_completed", u.getId(), Map.of("profileType", "USER"));
        return userService.describe(u);
    }

    @PostMapping("/change-password")
    public Map<String, Object> changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        auth.changePassword(Current.user().id(), req);
        return Map.of("changed", true, "message", "Password changed. Please sign in again.");
    }

    @PostMapping("/resend-verification")
    public Map<String, Object> resend() {
        String dev = auth.resendVerification(Current.user().id());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("sent", true);
        if (dev != null) m.put("devVerificationToken", dev);
        return m;
    }

    public record AdvertiserRequest(@NotBlank @Size(min = 2, max = 120) String businessName, UUID categoryId,
                                    @Pattern(regexp = URL_RULE, message = "Use a full https:// address") String website,
                                    @Size(max = 2000) String description, @Size(max = 500) String logoUrl, @Size(max = 80) String city) {}

    @PutMapping("/advertiser-profile")
    @Transactional
    public Map<String, Object> saveAdvertiser(@Valid @RequestBody AdvertiserRequest req) {
        User u = me();
        if (req.categoryId() != null && !categories.existsById(req.categoryId())) throw ApiException.badRequest("BAD_CATEGORY", "Unknown category");
        AdvertiserProfile a = advertisers.findByUserId(u.getId()).orElse(null);
        boolean created = a == null;
        if (created) {
            a = new AdvertiserProfile();
            a.setUserId(u.getId());
            String base = Util.slugify(req.businessName()), slug = base;
            while (advertisers.existsBySlug(slug)) slug = base + "-" + Util.randomCode(4).toLowerCase();
            a.setSlug(slug);
        }
        a.setBusinessName(req.businessName().trim());
        a.setCategoryId(req.categoryId());
        a.setWebsite(Util.blankToNull(req.website()));
        a.setDescription(Util.blankToNull(req.description()));
        a.setLogoUrl(Util.blankToNull(req.logoUrl()));
        a.setCity(Util.blankToNull(req.city()));
        advertisers.save(a);
        if (created) {
            u.getRoles().add("ADVERTISER");
            users.save(u);
            events.track("profile_completed", u.getId(), Map.of("profileType", "ADVERTISER"));
        }
        return userService.describe(u);
    }

    public record PromoterRequest(@NotBlank @Size(min = 2, max = 120) String displayName, @Size(max = 2000) String bio,
                                  @Min(0) @Max(500_000_000) int audienceSize, @Size(max = 1000) String audienceDescription,
                                  @Size(max = 500) String interests, @Size(max = 200) String languages,
                                  @Pattern(regexp = URL_RULE, message = "Use a full https:// address") String instagramUrl,
                                  @Pattern(regexp = URL_RULE, message = "Use a full https:// address") String youtubeUrl,
                                  @Pattern(regexp = URL_RULE, message = "Use a full https:// address") String linkedinUrl,
                                  @Pattern(regexp = URL_RULE, message = "Use a full https:// address") String websiteUrl,
                                  @Pattern(regexp = "^$|^[\\w.\\-]{2,60}@[A-Za-z]{2,30}$", message = "Enter a valid UPI ID") String upiId) {}

    @PutMapping("/promoter-profile")
    @Transactional
    public Map<String, Object> savePromoter(@Valid @RequestBody PromoterRequest req) {
        User u = me();
        PromoterProfile p = promoters.findByUserId(u.getId()).orElse(null);
        boolean created = p == null;
        if (created) {
            p = new PromoterProfile();
            p.setUserId(u.getId());
            String base = Util.slugify(req.displayName()), slug = base;
            while (promoters.existsBySlug(slug)) slug = base + "-" + Util.randomCode(4).toLowerCase();
            p.setSlug(slug);
        }
        p.setDisplayName(req.displayName().trim());
        p.setBio(Util.blankToNull(req.bio()));
        p.setAudienceSize(req.audienceSize());
        p.setAudienceDescription(Util.blankToNull(req.audienceDescription()));
        p.setInterests(Util.blankToNull(req.interests()));
        p.setLanguages(Util.blankToNull(req.languages()));
        p.setInstagramUrl(Util.blankToNull(req.instagramUrl()));
        p.setYoutubeUrl(Util.blankToNull(req.youtubeUrl()));
        p.setLinkedinUrl(Util.blankToNull(req.linkedinUrl()));
        p.setWebsiteUrl(Util.blankToNull(req.websiteUrl()));
        p.setUpiId(Util.blankToNull(req.upiId()));
        promoters.save(p);
        if (created) {
            u.getRoles().add("PROMOTER");
            users.save(u);
            events.track("profile_completed", u.getId(), Map.of("profileType", "PROMOTER"));
        }
        return userService.describe(u);
    }

    public record VerificationBody(@NotBlank @Pattern(regexp = "ADVERTISER|PROMOTER") String profileType,
                                   @Size(max = 1000) String note, @Size(max = 500) String documentUrl) {}

    @PostMapping("/verification-requests")
    @Transactional
    public Map<String, Object> requestVerification(@Valid @RequestBody VerificationBody req) {
        AuthUser au = Current.user();
        Current.requireVerifiedEmail();
        if (verifications.existsByUserIdAndProfileTypeAndStatus(au.id(), req.profileType(), "PENDING"))
            throw ApiException.conflict("ALREADY_PENDING", "A verification request is already under review");
        if ("ADVERTISER".equals(req.profileType())) {
            AdvertiserProfile a = advertisers.findByUserId(au.id()).orElseThrow(() -> ApiException.badRequest("NO_PROFILE", "Create a business profile first"));
            a.setVerificationStatus("PENDING");
            advertisers.save(a);
        } else {
            PromoterProfile p = promoters.findByUserId(au.id()).orElseThrow(() -> ApiException.badRequest("NO_PROFILE", "Create a promoter profile first"));
            p.setVerificationStatus("PENDING");
            promoters.save(p);
        }
        VerificationRequest v = new VerificationRequest();
        v.setUserId(au.id());
        v.setProfileType(req.profileType());
        v.setNote(Util.blankToNull(req.note()));
        v.setDocumentUrl(Util.blankToNull(req.documentUrl()));
        verifications.save(v);
        notifications.notifyStaff("verification.review", "ADMIN_ALERT", "New verification request", au.email(), "/admin/verifications");
        return Map.of("id", v.getId(), "status", v.getStatus());
    }

    @GetMapping("/notifications")
    public Map<String, Object> notifications(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        UUID id = Current.user().id();
        PageResponse<Map<String, Object>> p = sql.page("SELECT id, type, title, body, link, read_at, created_at",
                "FROM notifications WHERE user_id = :u", "created_at DESC", Map.of("u", id), page, size);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("unread", sql.count("SELECT count(*) FROM notifications WHERE user_id = :u AND read_at IS NULL", Map.of("u", id)));
        m.put("page", p);
        return m;
    }

    @PostMapping("/notifications/read-all")
    public Map<String, Object> readAll() {
        return Map.of("updated", sql.update("UPDATE notifications SET read_at = now() WHERE user_id = :u AND read_at IS NULL", Map.of("u", Current.user().id())));
    }

    @PostMapping("/notifications/{id}/read")
    public Map<String, Object> read(@PathVariable UUID id) {
        return Map.of("updated", sql.update("UPDATE notifications SET read_at = now() WHERE id = :id AND user_id = :u AND read_at IS NULL",
                Map.of("id", id, "u", Current.user().id())));
    }

    @GetMapping("/referrals")
    public Map<String, Object> referralDashboard() {
        UUID id = Current.user().id();
        String code = referrals.ensureCode(id).getCode();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("code", code);
        m.put("url", props.publicUrl() + "/register?ref=" + code);
        m.put("summary", sql.one("""
                SELECT count(*) AS signed_up,
                       count(*) FILTER (WHERE r.status = 'ACTIVATED') AS activated,
                       count(*) FILTER (WHERE rw.status = 'APPROVED') AS rewarded,
                       coalesce(sum(rw.amount_paise) FILTER (WHERE rw.status = 'APPROVED'), 0) AS credits_earned_paise,
                       coalesce(sum(rw.amount_paise) FILTER (WHERE rw.status = 'PENDING_APPROVAL'), 0) AS credits_pending_paise
                FROM referrals r LEFT JOIN referral_rewards rw ON rw.referral_id = r.id WHERE r.referrer_user_id = :u""", Map.of("u", id)));
        // Referred people are shown by first name only.
        m.put("referrals", sql.list("""
                SELECT r.id, split_part(u.full_name, ' ', 1) AS first_name, r.status, r.referred_type, r.created_at, r.activated_at,
                       rw.status AS reward_status, rw.amount_paise AS reward_paise
                FROM referrals r JOIN users u ON u.id = r.referred_user_id LEFT JOIN referral_rewards rw ON rw.referral_id = r.id
                WHERE r.referrer_user_id = :u ORDER BY r.created_at DESC LIMIT 100""", Map.of("u", id)));
        m.put("rules", Map.of(
                "businessRewardPaise", sql.one("SELECT value FROM platform_settings WHERE key = 'referral.reward_business_paise'", Map.of()).get("value"),
                "promoterRewardPaise", sql.one("SELECT value FROM platform_settings WHERE key = 'referral.reward_promoter_paise'", Map.of()).get("value")));
        return m;
    }

    @GetMapping("/transactions")
    public PageResponse<Map<String, Object>> transactions(@RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return sql.page("""
                SELECT t.id, t.type, t.amount_paise, t.base_paise, t.fee_paise, t.tax_paise, t.credit_paise, t.currency, t.status, t.provider,
                       t.provider_order_id, t.description, t.created_at, c.title AS campaign_title, t.campaign_id""",
                "FROM transactions t LEFT JOIN campaigns c ON c.id = t.campaign_id WHERE t.user_id = :u", "t.created_at DESC",
                Map.of("u", Current.user().id()), page, size);
    }

    /** Self-service copy of the personal data held about the signed-in user. */
    @GetMapping("/data-export")
    public Map<String, Object> export() {
        User u = me();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("generatedAt", Instant.now());
        m.put("account", userService.describe(u));
        m.put("transactions", sql.list("SELECT id, type, amount_paise, status, created_at FROM transactions WHERE user_id = :u", Map.of("u", u.getId())));
        m.put("campaigns", sql.list("SELECT id, title, status, created_at FROM campaigns WHERE owner_user_id = :u", Map.of("u", u.getId())));
        m.put("applications", sql.list("SELECT id, campaign_id, status, created_at FROM campaign_applications WHERE user_id = :u", Map.of("u", u.getId())));
        return m;
    }
}
