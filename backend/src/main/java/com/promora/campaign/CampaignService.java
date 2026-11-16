package com.promora.campaign;

import com.promora.admin.SettingsService;
import com.promora.advertiser.AdvertiserProfile;
import com.promora.advertiser.AdvertiserProfileRepository;
import com.promora.analytics.EventService;
import com.promora.audit.AuditService;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.notification.NotificationService;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CampaignService {
    public static final Set<String> OBJECTIVES = Set.of("WEBSITE_VISITS", "LEADS", "APP_INSTALLS", "SALES", "AWARENESS", "FOLLOWERS");
    private final CampaignRepository campaigns;
    private final CampaignAssetRepository assets;
    private final AdvertiserProfileRepository advertisers;
    private final CategoryRepository categories;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final EventService events;
    private final AuditService audit;

    public CampaignService(CampaignRepository campaigns, CampaignAssetRepository assets, AdvertiserProfileRepository advertisers, CategoryRepository categories,
                           SettingsService settings, NotificationService notifications, EventService events, AuditService audit) {
        this.campaigns = campaigns; this.assets = assets; this.advertisers = advertisers; this.categories = categories;
        this.settings = settings; this.notifications = notifications; this.events = events; this.audit = audit;
    }

    /** Draft payload. Drafts may be incomplete; completeness is enforced when the campaign is submitted. */
    public record CampaignRequest(
            @NotBlank @Size(min = 5, max = 140) String title,
            @Size(max = 5000) String description,
            UUID categoryId,
            @Pattern(regexp = "WEBSITE_VISITS|LEADS|APP_INSTALLS|SALES|AWARENESS|FOLLOWERS") String objective,
            @Size(max = 1000) String targetAudience,
            @Size(max = 300) String geography,
            @Pattern(regexp = "^$|^https://[^\\s]{3,490}$", message = "Landing page must be a full https:// address") String landingUrl,
            @Pattern(regexp = "CPC|CPL") String rewardType,
            @Min(0) @Max(10_000_00) Long rewardPaise,
            @Min(0) @Max(10_000_000_00L) Long budgetPaise,
            LocalDate startDate, LocalDate endDate,
            @Pattern(regexp = "OPEN|APPROVAL") String applicationMode,
            @Size(max = 2000) String promoInstructions,
            @Size(max = 300) String disclosureText,
            @Size(max = 6) List<@Pattern(regexp = "^(https://|/files/)[^\\s]{3,480}$", message = "Image must be an uploaded file or https:// address") String> imageUrls) {}

    public Campaign owned(UUID id) {
        Campaign c = campaigns.findById(id).orElseThrow(() -> ApiException.notFound("Campaign"));
        if (!c.getOwnerUserId().equals(Current.user().id())) throw ApiException.notFound("Campaign"); // do not reveal other owners' campaigns
        return c;
    }

    @Transactional
    public Campaign create(CampaignRequest req) {
        AuthUser user = Current.user();
        AdvertiserProfile adv = advertisers.findByUserId(user.id())
                .orElseThrow(() -> ApiException.badRequest("NO_ADVERTISER_PROFILE", "Create a business profile before creating campaigns"));
        Campaign c = new Campaign();
        c.setAdvertiserId(adv.getId());
        c.setOwnerUserId(user.id());
        String base = Util.slugify(req.title()), slug = base;
        while (campaigns.existsBySlug(slug)) slug = base + "-" + Util.randomCode(5).toLowerCase();
        c.setSlug(slug);
        c.setDescription("");
        apply(c, req);
        campaigns.save(c);
        saveAssets(c, req.imageUrls());
        events.track("campaign_created", user.id(), Map.of("campaignId", c.getId().toString()));
        return c;
    }

    @Transactional
    public Campaign update(UUID id, CampaignRequest req) {
        Campaign c = owned(id);
        if (!CampaignStatus.editable(c.getStatus()))
            throw ApiException.conflict("NOT_EDITABLE", "Only draft campaigns, or campaigns with changes requested, can be edited");
        apply(c, req);
        c.setUpdatedAt(Instant.now());
        campaigns.save(c);
        if (req.imageUrls() != null) saveAssets(c, req.imageUrls());
        return c;
    }

    private void apply(Campaign c, CampaignRequest r) {
        if (r.categoryId() != null && !categories.existsById(r.categoryId())) throw ApiException.badRequest("BAD_CATEGORY", "Unknown category");
        if (r.startDate() != null && r.endDate() != null && r.endDate().isBefore(r.startDate()))
            throw ApiException.unprocessable("BAD_DATES", "End date must be on or after the start date");
        c.setTitle(r.title().trim());
        if (r.description() != null) c.setDescription(r.description().trim());
        c.setCategoryId(r.categoryId());
        if (r.objective() != null) c.setObjective(r.objective());
        c.setTargetAudience(Util.blankToNull(r.targetAudience()));
        if (Util.blankToNull(r.geography()) != null) c.setGeography(r.geography().trim());
        c.setLandingUrl(Util.blankToNull(r.landingUrl()));
        if (r.rewardType() != null) c.setRewardType(r.rewardType());
        if (r.rewardPaise() != null) c.setRewardPaise(r.rewardPaise());
        if (r.budgetPaise() != null) c.setBudgetPaise(r.budgetPaise());
        c.setStartDate(r.startDate());
        c.setEndDate(r.endDate());
        if (r.applicationMode() != null) c.setApplicationMode(r.applicationMode());
        c.setPromoInstructions(Util.blankToNull(r.promoInstructions()));
        c.setDisclosureText(Util.blankToNull(r.disclosureText()));
    }

    private void saveAssets(Campaign c, List<String> urls) {
        if (urls == null) return;
        assets.deleteByCampaignId(c.getId());
        assets.flush();
        int i = 0;
        for (String url : urls) {
            CampaignAsset a = new CampaignAsset();
            a.setCampaignId(c.getId());
            a.setUrl(url);
            a.setAltText(c.getTitle());
            a.setSortOrder(i++);
            assets.save(a);
        }
    }

    /** Completeness rules applied when a draft is submitted for moderation. */
    public void validateForSubmission(Campaign c) {
        long minBudget = settings.getLong("campaign.min_budget_paise", 50000);
        if (c.getDescription() == null || c.getDescription().length() < 40) fail("Add a description of at least 40 characters");
        if (c.getCategoryId() == null) fail("Choose a category");
        if (c.getRewardPaise() < 100) fail("Reward must be at least ₹1 per result");
        if (c.getBudgetPaise() < minBudget) fail("Budget must be at least ₹" + (minBudget / 100));
        if (c.getBudgetPaise() < c.getRewardPaise()) fail("Budget must cover at least one reward");
        if ("CPC".equals(c.getRewardType()) && c.getLandingUrl() == null) fail("Add the landing page promoters should send visitors to");
        if (c.getEndDate() != null && c.getEndDate().isBefore(LocalDate.now())) fail("End date is in the past");
    }
    private static void fail(String message) { throw ApiException.unprocessable("CAMPAIGN_INCOMPLETE", message); }

    @Transactional
    public Campaign submit(UUID id) {
        Current.requireVerifiedEmail();
        Campaign c = owned(id);
        CampaignStatus.require(c.getStatus(), CampaignStatus.PENDING_REVIEW);
        validateForSubmission(c);
        c.setStatus(CampaignStatus.PENDING_REVIEW);
        c.setSubmittedAt(Instant.now());
        c.setReviewNote(null);
        c.setUpdatedAt(Instant.now());
        campaigns.save(c);
        events.track("campaign_submitted", c.getOwnerUserId(), Map.of("campaignId", c.getId().toString()));
        notifications.notifyStaff("campaign.moderate", "ADMIN_ALERT", "Campaign awaiting review", c.getTitle(), "/admin/campaigns?status=PENDING_REVIEW");
        return c;
    }

    /** Owner-initiated lifecycle change: PAUSED, ACTIVE (resume), CANCELLED or COMPLETED. */
    @Transactional
    public Campaign ownerTransition(UUID id, String target) {
        Campaign c = campaigns.lockById(owned(id).getId()).orElseThrow();
        if (CampaignStatus.ACTIVE.equals(target) && !CampaignStatus.PAUSED.equals(c.getStatus()))
            throw ApiException.conflict("INVALID_TRANSITION", "Only a paused campaign can be resumed");
        CampaignStatus.require(c.getStatus(), target);
        c.setStatus(target);
        c.setUpdatedAt(Instant.now());
        campaigns.save(c);
        audit.log(Current.user(), "CAMPAIGN_" + target, "CAMPAIGN", c.getId(), null);
        if (CampaignStatus.COMPLETED.equals(target)) events.track("campaign_completed", c.getOwnerUserId(), Map.of("campaignId", c.getId().toString()));
        return c;
    }
}
