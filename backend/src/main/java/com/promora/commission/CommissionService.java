package com.promora.commission;

import com.promora.admin.SettingsService;
import com.promora.analytics.EventService;
import com.promora.campaign.Campaign;
import com.promora.campaign.CampaignRepository;
import com.promora.campaign.CampaignStatus;
import com.promora.common.ApiException;
import com.promora.notification.NotificationService;
import com.promora.tracking.ConversionEvent;
import com.promora.tracking.ConversionEventRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CommissionService {
    private final CommissionRepository commissions;
    private final ConversionEventRepository conversions;
    private final CampaignRepository campaigns;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final EventService events;

    public CommissionService(CommissionRepository commissions, ConversionEventRepository conversions, CampaignRepository campaigns,
                             SettingsService settings, NotificationService notifications, EventService events) {
        this.commissions = commissions; this.conversions = conversions; this.campaigns = campaigns;
        this.settings = settings; this.notifications = notifications; this.events = events;
    }

    /**
     * Records a verified conversion and its commission. Must run inside the caller's transaction with the campaign row
     * locked ({@code CampaignRepository.lockById}), so two events can never spend the same rupee of budget.
     * Returns null when the conversion is a duplicate or the budget cannot cover the reward.
     */
    public Commission record(Campaign lockedCampaign, ConversionEvent conversion) {
        if (conversions.existsByCampaignIdAndDedupeKey(lockedCampaign.getId(), conversion.getDedupeKey())) return null;
        long reward = lockedCampaign.getRewardPaise();
        if (lockedCampaign.getFundedPaise() - lockedCampaign.getSpentPaise() < reward) return null;
        conversions.save(conversion);
        long feeBps = settings.getLong("commission.platform_fee_bps", 1500);
        Commission c = new Commission();
        c.setConversionEventId(conversion.getId());
        c.setCampaignId(lockedCampaign.getId());
        c.setPromoterUserId(conversion.getPromoterUserId());
        c.setAmountPaise(reward);
        c.setPlatformFeePaise(Math.round(reward * feeBps / 10000.0));
        c.setHoldUntil(Instant.now().plus(settings.getLong("commission.hold_days", 7), ChronoUnit.DAYS));
        commissions.save(c);
        lockedCampaign.setSpentPaise(lockedCampaign.getSpentPaise() + reward);
        if (lockedCampaign.getFundedPaise() - lockedCampaign.getSpentPaise() < reward && CampaignStatus.ACTIVE.equals(lockedCampaign.getStatus())) {
            lockedCampaign.setStatus(CampaignStatus.COMPLETED);
            events.track("campaign_completed", lockedCampaign.getOwnerUserId(), Map.of("campaignId", lockedCampaign.getId().toString(), "reason", "budget_spent"));
            notifications.notify(lockedCampaign.getOwnerUserId(), "CAMPAIGN", "Campaign budget fully used",
                    "\"" + lockedCampaign.getTitle() + "\" has completed.", "/dashboard/advertiser/campaigns/" + lockedCampaign.getId());
        }
        lockedCampaign.setUpdatedAt(Instant.now());
        campaigns.save(lockedCampaign);
        return c;
    }

    /** Moves commissions past their hold period from PENDING to APPROVED (eligible for payout). */
    @Scheduled(fixedDelayString = "PT10M", initialDelayString = "PT1M")
    @Transactional
    public int releaseDue() {
        List<Commission> due = commissions.findByStatusAndHoldUntilBefore("PENDING", Instant.now());
        due.forEach(c -> { c.setStatus("APPROVED"); commissions.save(c); });
        return due.size();
    }

    /** Admin action: release now, or reverse a commission and return the money to the campaign budget. */
    @Transactional
    public Commission adminDecide(UUID id, boolean reverse) {
        Commission c = commissions.findById(id).orElseThrow(() -> ApiException.notFound("Commission"));
        if (reverse) {
            if ("PAID".equals(c.getStatus()) || "REVERSED".equals(c.getStatus()) || c.getPayoutRequestId() != null)
                throw ApiException.conflict("NOT_REVERSIBLE", "This commission is already paid, reversed or part of a payout request");
            Campaign campaign = campaigns.lockById(c.getCampaignId()).orElseThrow();
            campaign.setSpentPaise(Math.max(0, campaign.getSpentPaise() - c.getAmountPaise()));
            campaigns.save(campaign);
            c.setStatus("REVERSED");
            conversions.findById(c.getConversionEventId()).ifPresent(v -> { v.setStatus("REVERSED"); conversions.save(v); });
            notifications.notify(c.getPromoterUserId(), "COMMISSION", "A commission was reversed", "It did not pass verification.", "/dashboard/promoter/earnings");
        } else {
            if (!"PENDING".equals(c.getStatus())) throw ApiException.conflict("NOT_PENDING", "Only pending commissions can be released");
            c.setStatus("APPROVED");
        }
        return commissions.save(c);
    }
}
