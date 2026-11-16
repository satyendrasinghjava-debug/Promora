package com.promora.marketplace;

import com.promora.analytics.EventService;
import com.promora.campaign.Campaign;
import com.promora.campaign.CampaignRepository;
import com.promora.campaign.CampaignStatus;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.notification.NotificationService;
import com.promora.promoter.PromoterProfile;
import com.promora.promoter.PromoterProfileRepository;
import com.promora.referral.ReferralService;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import com.promora.tracking.TrackingLink;
import com.promora.tracking.TrackingLinkRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class ApplicationService {
    private final CampaignApplicationRepository applications;
    private final CampaignRepository campaigns;
    private final PromoterProfileRepository promoters;
    private final TrackingLinkRepository links;
    private final NotificationService notifications;
    private final ReferralService referrals;
    private final EventService events;

    public ApplicationService(CampaignApplicationRepository applications, CampaignRepository campaigns, PromoterProfileRepository promoters,
                              TrackingLinkRepository links, NotificationService notifications, ReferralService referrals, EventService events) {
        this.applications = applications; this.campaigns = campaigns; this.promoters = promoters; this.links = links;
        this.notifications = notifications; this.referrals = referrals; this.events = events;
    }

    @Transactional
    public CampaignApplication apply(UUID campaignId, String pitch) {
        AuthUser user = Current.user();
        Current.requireVerifiedEmail();
        PromoterProfile promoter = promoters.findByUserId(user.id())
                .orElseThrow(() -> ApiException.badRequest("NO_PROMOTER_PROFILE", "Create a promoter profile before applying"));
        Campaign c = campaigns.findById(campaignId).orElseThrow(() -> ApiException.notFound("Campaign"));
        if (!CampaignStatus.ACTIVE.equals(c.getStatus())) throw ApiException.conflict("CAMPAIGN_NOT_OPEN", "This campaign is not accepting promoters");
        if (c.getOwnerUserId().equals(user.id())) throw ApiException.unprocessable("OWN_CAMPAIGN", "You cannot promote your own campaign");
        CampaignApplication existing = applications.findByCampaignIdAndUserId(campaignId, user.id()).orElse(null);
        if (existing != null && !"WITHDRAWN".equals(existing.getStatus()))
            throw ApiException.conflict("ALREADY_APPLIED", "You have already applied to this campaign");
        CampaignApplication a = existing != null ? existing : new CampaignApplication();
        a.setCampaignId(campaignId);
        a.setPromoterId(promoter.getId());
        a.setUserId(user.id());
        a.setPitch(Util.blankToNull(pitch));
        a.setStatus("PENDING");
        a.setDecidedAt(null);
        a.setCreatedAt(Instant.now());
        applications.save(a);
        if ("OPEN".equals(c.getApplicationMode())) {
            approveInternal(a, c, "Joined automatically (open campaign)");
        } else {
            notifications.notify(c.getOwnerUserId(), "APPLICATION", "New promoter application",
                    promoter.getDisplayName() + " applied to \"" + c.getTitle() + "\".", "/dashboard/advertiser/campaigns/" + c.getId());
        }
        return a;
    }

    private void approveInternal(CampaignApplication a, Campaign c, String note) {
        a.setStatus("APPROVED");
        a.setDecisionNote(note);
        a.setDecidedAt(Instant.now());
        applications.save(a);
        TrackingLink link = links.findByApplicationId(a.getId()).orElse(null);
        if (link == null) {
            link = new TrackingLink();
            link.setApplicationId(a.getId());
            link.setCampaignId(c.getId());
            link.setPromoterUserId(a.getUserId());
            String code;
            do { code = Util.randomCode(8); } while (links.findByCode(code).isPresent());
            link.setCode(code);
        }
        link.setActive(true);
        links.save(link);
        events.track("promoter_joined", a.getUserId(), Map.of("campaignId", c.getId().toString()));
        notifications.notify(a.getUserId(), "APPLICATION", "You're in: " + c.getTitle(),
                "Your tracking link is ready. Share it to start earning.", "/dashboard/promoter/campaigns");
        referrals.activate(a.getUserId(), "PROMOTER");
    }

    /** Decision by the campaign owner: approve, reject, or remove an approved promoter. */
    @Transactional
    public CampaignApplication decide(UUID applicationId, String decision, String note) {
        CampaignApplication a = applications.findById(applicationId).orElseThrow(() -> ApiException.notFound("Application"));
        Campaign c = campaigns.findById(a.getCampaignId()).orElseThrow();
        if (!c.getOwnerUserId().equals(Current.user().id())) throw ApiException.notFound("Application");
        switch (decision) {
            case "approve" -> {
                if (!"PENDING".equals(a.getStatus())) throw ApiException.conflict("ALREADY_DECIDED", "This application was already decided");
                approveInternal(a, c, note);
            }
            case "reject" -> {
                if (!"PENDING".equals(a.getStatus())) throw ApiException.conflict("ALREADY_DECIDED", "This application was already decided");
                a.setStatus("REJECTED");
                a.setDecisionNote(note);
                a.setDecidedAt(Instant.now());
                applications.save(a);
                notifications.notify(a.getUserId(), "APPLICATION", "Application not accepted",
                        "\"" + c.getTitle() + "\"" + (note == null ? "" : ": " + note), "/dashboard/promoter/applications");
            }
            case "remove" -> {
                if (!"APPROVED".equals(a.getStatus())) throw ApiException.conflict("NOT_APPROVED", "Only approved promoters can be removed");
                a.setStatus("REMOVED");
                a.setDecisionNote(note);
                a.setDecidedAt(Instant.now());
                applications.save(a);
                links.findByApplicationId(a.getId()).ifPresent(l -> { l.setActive(false); links.save(l); });
                notifications.notify(a.getUserId(), "APPLICATION", "Removed from campaign", "\"" + c.getTitle() + "\"", "/dashboard/promoter/applications");
            }
            default -> throw ApiException.badRequest("BAD_DECISION", "Unknown decision");
        }
        return a;
    }

    @Transactional
    public void withdraw(UUID applicationId) {
        CampaignApplication a = applications.findById(applicationId).orElseThrow(() -> ApiException.notFound("Application"));
        if (!a.getUserId().equals(Current.user().id())) throw ApiException.notFound("Application");
        if (!"PENDING".equals(a.getStatus()) && !"APPROVED".equals(a.getStatus())) throw ApiException.conflict("NOT_ACTIVE", "This application is not active");
        a.setStatus("WITHDRAWN");
        a.setDecidedAt(Instant.now());
        applications.save(a);
        links.findByApplicationId(a.getId()).ifPresent(l -> { l.setActive(false); links.save(l); });
    }
}
