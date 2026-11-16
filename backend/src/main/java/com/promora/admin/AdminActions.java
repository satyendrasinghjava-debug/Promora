package com.promora.admin;

import com.promora.advertiser.AdvertiserProfileRepository;
import com.promora.analytics.EventService;
import com.promora.audit.AuditService;
import com.promora.auth.AuthService;
import com.promora.campaign.Campaign;
import com.promora.campaign.CampaignRepository;
import com.promora.campaign.CampaignStatus;
import com.promora.common.ApiException;
import com.promora.moderation.*;
import com.promora.notification.NotificationService;
import com.promora.promoter.PromoterProfileRepository;
import com.promora.referral.ReferralService;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import com.promora.user.User;
import com.promora.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Transactional admin operations. Each writes a moderation action and an audit log entry in the same transaction. */
@Service
public class AdminActions {
    private final CampaignRepository campaigns;
    private final UserRepository users;
    private final AdvertiserProfileRepository advertisers;
    private final PromoterProfileRepository promoters;
    private final VerificationRequestRepository verifications;
    private final UserReportRepository reports;
    private final RiskFlagRepository riskFlags;
    private final ModerationActionRepository actions;
    private final NotificationService notifications;
    private final ReferralService referrals;
    private final EventService events;
    private final AuditService audit;
    private final AuthService auth;
    private final SettingsService settings;
    private final JdbcTemplate jdbc;

    public AdminActions(CampaignRepository campaigns, UserRepository users, AdvertiserProfileRepository advertisers, PromoterProfileRepository promoters,
                        VerificationRequestRepository verifications, UserReportRepository reports, RiskFlagRepository riskFlags, ModerationActionRepository actions,
                        NotificationService notifications, ReferralService referrals, EventService events, AuditService audit, AuthService auth,
                        SettingsService settings, JdbcTemplate jdbc) {
        this.campaigns = campaigns; this.users = users; this.advertisers = advertisers; this.promoters = promoters; this.verifications = verifications;
        this.reports = reports; this.riskFlags = riskFlags; this.actions = actions; this.notifications = notifications; this.referrals = referrals;
        this.events = events; this.audit = audit; this.auth = auth; this.settings = settings; this.jdbc = jdbc;
    }

    private void record(AuthUser admin, String targetType, UUID targetId, String action, String reason) {
        ModerationAction a = new ModerationAction();
        a.setAdminUserId(admin.id());
        a.setTargetType(targetType);
        a.setTargetId(targetId);
        a.setAction(action);
        a.setReason(reason);
        actions.save(a);
        audit.log(admin, action, targetType, targetId, reason);
    }

    private static String requireReason(String reason) {
        if (reason == null || reason.isBlank()) throw ApiException.unprocessable("REASON_REQUIRED", "A reason is required for this action");
        return reason.trim();
    }

    @Transactional
    public Campaign moderateCampaign(UUID id, String action, String reason) {
        AuthUser admin = Current.user();
        Campaign c = campaigns.lockById(id).orElseThrow(() -> ApiException.notFound("Campaign"));
        String link = "/dashboard/advertiser/campaigns/" + c.getId();
        switch (action) {
            case "approve" -> {
                CampaignStatus.require(c.getStatus(), CampaignStatus.APPROVED);
                // A campaign that is already funded (for example after an edit cycle) goes straight to live.
                c.setStatus(c.getFundedPaise() - c.getSpentPaise() >= c.getRewardPaise() && c.getFundedPaise() > 0 ? CampaignStatus.ACTIVE : CampaignStatus.APPROVED);
                c.setApprovedAt(Instant.now());
                c.setReviewNote(null);
                events.track("campaign_approved", c.getOwnerUserId(), Map.of("campaignId", c.getId().toString()));
                notifications.notify(c.getOwnerUserId(), "CAMPAIGN_APPROVED", "Campaign approved",
                        settings.get("notification.template.campaign_approved", "Your campaign \"{title}\" was approved.").replace("{title}", c.getTitle())
                                + " Fund it to go live.", link);
                users.findById(c.getOwnerUserId()).ifPresent(u -> notifications.email(u.getEmail(), "Your Promora campaign was approved",
                        "\"" + c.getTitle() + "\" was approved. Fund the campaign from your dashboard to make it live."));
                referrals.activate(c.getOwnerUserId(), "BUSINESS");
            }
            case "reject" -> {
                CampaignStatus.require(c.getStatus(), CampaignStatus.REJECTED);
                c.setStatus(CampaignStatus.REJECTED);
                c.setReviewNote(requireReason(reason));
                notifications.notify(c.getOwnerUserId(), "CAMPAIGN_REJECTED", "Campaign not approved",
                        settings.get("notification.template.campaign_rejected", "Your campaign \"{title}\" was not approved: {reason}")
                                .replace("{title}", c.getTitle()).replace("{reason}", reason.trim()), link);
                users.findById(c.getOwnerUserId()).ifPresent(u -> notifications.email(u.getEmail(), "Your Promora campaign was not approved",
                        "\"" + c.getTitle() + "\" was not approved.\n\nReason: " + reason.trim()));
            }
            case "request-changes" -> {
                CampaignStatus.require(c.getStatus(), CampaignStatus.CHANGES_REQUESTED);
                c.setStatus(CampaignStatus.CHANGES_REQUESTED);
                c.setReviewNote(requireReason(reason));
                notifications.notify(c.getOwnerUserId(), "CAMPAIGN_CHANGES", "Changes requested on your campaign", "\"" + c.getTitle() + "\": " + reason.trim(), link);
            }
            case "pause" -> {
                CampaignStatus.require(c.getStatus(), CampaignStatus.PAUSED);
                c.setStatus(CampaignStatus.PAUSED);
                c.setReviewNote(requireReason(reason));
                notifications.notify(c.getOwnerUserId(), "CAMPAIGN", "Campaign paused by Promora", "\"" + c.getTitle() + "\": " + reason.trim(), link);
            }
            case "terminate" -> {
                CampaignStatus.require(c.getStatus(), CampaignStatus.TERMINATED);
                c.setStatus(CampaignStatus.TERMINATED);
                c.setReviewNote(requireReason(reason));
                notifications.notify(c.getOwnerUserId(), "CAMPAIGN", "Campaign terminated", "\"" + c.getTitle() + "\": " + reason.trim(), link);
            }
            case "feature", "unfeature" -> c.setFeatured("feature".equals(action));
            default -> throw ApiException.badRequest("BAD_ACTION", "Unknown action");
        }
        c.setUpdatedAt(Instant.now());
        campaigns.save(c);
        record(admin, "CAMPAIGN", c.getId(), "CAMPAIGN_" + action.toUpperCase().replace('-', '_'), reason);
        return c;
    }

    @Transactional
    public void setUserStatus(UUID userId, boolean suspend, String reason) {
        AuthUser admin = Current.user();
        if (admin.id().equals(userId)) throw ApiException.unprocessable("SELF_ACTION", "You cannot change your own account status");
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (u.isStaff() && !admin.hasRole("SUPER_ADMIN")) throw ApiException.forbidden("Only a super admin can change staff accounts");
        if (suspend) {
            requireReason(reason);
            u.setStatus("SUSPENDED");
            auth.revokeAll(u.getId());
            // Stop the suspended user's links from earning and take their campaigns out of the marketplace.
            jdbc.update("UPDATE tracking_links SET active = FALSE WHERE promoter_user_id = ?", u.getId());
            jdbc.update("UPDATE campaigns SET status = 'PAUSED', review_note = 'Owner account suspended', updated_at = now() WHERE owner_user_id = ? AND status = 'ACTIVE'", u.getId());
        } else {
            u.setStatus("ACTIVE");
            jdbc.update("UPDATE tracking_links l SET active = TRUE FROM campaign_applications a WHERE a.id = l.application_id AND a.status = 'APPROVED' AND l.promoter_user_id = ?", u.getId());
        }
        u.setUpdatedAt(Instant.now());
        users.save(u);
        record(admin, "USER", u.getId(), suspend ? "USER_SUSPENDED" : "USER_REACTIVATED", reason);
    }

    @Transactional
    public void setVerifiedBadge(UUID userId, boolean verified) {
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        u.setVerifiedBadge(verified);
        if (verified) u.setEmailVerified(true);
        users.save(u);
        record(Current.user(), "USER", u.getId(), verified ? "USER_VERIFIED" : "USER_UNVERIFIED", null);
    }

    @Transactional
    public void setRoles(UUID userId, Set<String> roles) {
        AuthUser admin = Current.user();
        if (admin.id().equals(userId)) throw ApiException.unprocessable("SELF_ACTION", "You cannot change your own roles");
        Set<String> allowed = Set.of("USER", "ADVERTISER", "PROMOTER", "ADMIN", "SUPER_ADMIN");
        if (!allowed.containsAll(roles)) throw ApiException.badRequest("BAD_ROLE", "Unknown role");
        User u = users.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        boolean staffChange = roles.contains("ADMIN") != u.hasRole("ADMIN") || roles.contains("SUPER_ADMIN") != u.hasRole("SUPER_ADMIN");
        if (staffChange && !admin.hasRole("SUPER_ADMIN")) throw ApiException.forbidden("Only a super admin can grant or remove staff roles");
        String before = String.join(",", new java.util.TreeSet<>(u.getRoles()));
        u.getRoles().clear();
        u.getRoles().addAll(roles);
        u.getRoles().add("USER");
        users.save(u);
        record(admin, "USER", u.getId(), "USER_ROLES_CHANGED", before + " -> " + String.join(",", new java.util.TreeSet<>(u.getRoles())));
    }

    @Transactional
    public void decideVerification(UUID id, boolean approve, String reason) {
        AuthUser admin = Current.user();
        VerificationRequest v = verifications.findById(id).orElseThrow(() -> ApiException.notFound("Verification request"));
        if (!"PENDING".equals(v.getStatus())) throw ApiException.conflict("ALREADY_DECIDED", "This request was already decided");
        if (!approve) requireReason(reason);
        String status = approve ? "VERIFIED" : "REJECTED";
        if ("ADVERTISER".equals(v.getProfileType())) advertisers.findByUserId(v.getUserId()).ifPresent(a -> { a.setVerificationStatus(status); advertisers.save(a); });
        else promoters.findByUserId(v.getUserId()).ifPresent(p -> { p.setVerificationStatus(status); promoters.save(p); });
        v.setStatus(approve ? "APPROVED" : "REJECTED");
        v.setDecisionReason(reason);
        v.setDecidedBy(admin.id());
        v.setDecidedAt(Instant.now());
        verifications.save(v);
        notifications.notify(v.getUserId(), "VERIFICATION", approve ? "Profile verified" : "Verification not approved",
                approve ? "Your profile now shows a verified badge." : reason, "/dashboard/settings");
        record(admin, "VERIFICATION", v.getId(), approve ? "VERIFICATION_APPROVED" : "VERIFICATION_REJECTED", reason);
    }

    /** Resolves a user report. REMOVE_CONTENT also takes the reported item out of public view. */
    @Transactional
    public void resolveReport(UUID id, String action, String resolution) {
        AuthUser admin = Current.user();
        UserReport r = reports.findById(id).orElseThrow(() -> ApiException.notFound("Report"));
        if (!"OPEN".equals(r.getStatus())) throw ApiException.conflict("ALREADY_RESOLVED", "This report was already handled");
        requireReason(resolution);
        switch (action) {
            case "DISMISS" -> r.setStatus("DISMISSED");
            case "RESOLVE" -> r.setStatus("RESOLVED");
            case "REMOVE_CONTENT" -> {
                r.setStatus("RESOLVED");
                setContentHidden(r.getTargetType(), r.getTargetId(), true, resolution);
            }
            default -> throw ApiException.badRequest("BAD_ACTION", "Unknown action");
        }
        r.setResolution(resolution.trim());
        r.setResolvedBy(admin.id());
        r.setResolvedAt(Instant.now());
        reports.save(r);
        record(admin, "REPORT", r.getId(), "REPORT_" + action, resolution);
    }

    @Transactional
    public void setContentHidden(String targetType, UUID targetId, boolean hidden, String reason) {
        AuthUser admin = Current.user();
        requireReason(reason);
        switch (targetType) {
            case "CAMPAIGN" -> {
                Campaign c = campaigns.lockById(targetId).orElseThrow(() -> ApiException.notFound("Campaign"));
                if (hidden && CampaignStatus.canTransition(c.getStatus(), CampaignStatus.TERMINATED)) {
                    c.setStatus(CampaignStatus.TERMINATED);
                    c.setReviewNote(reason.trim());
                    campaigns.save(c);
                    notifications.notify(c.getOwnerUserId(), "CAMPAIGN", "Campaign removed", "\"" + c.getTitle() + "\": " + reason.trim(), "/dashboard/advertiser/campaigns/" + c.getId());
                } else if (hidden) throw ApiException.conflict("NOT_REMOVABLE", "This campaign is not live");
                else throw ApiException.conflict("NOT_RESTORABLE", "A terminated campaign cannot be restored; the advertiser can create a new one");
            }
            case "BUSINESS" -> jdbc.update("UPDATE advertiser_profiles SET hidden = ? WHERE id = ?", hidden, targetId);
            case "CREATOR" -> jdbc.update("UPDATE promoter_profiles SET hidden = ? WHERE id = ?", hidden, targetId);
            default -> throw ApiException.badRequest("BAD_TARGET", "Unknown content type");
        }
        record(admin, targetType, targetId, hidden ? "CONTENT_REMOVED" : "CONTENT_RESTORED", reason);
    }

    @Transactional
    public void updateRiskFlag(UUID id, String status, String note) {
        AuthUser admin = Current.user();
        RiskFlag f = riskFlags.findById(id).orElseThrow(() -> ApiException.notFound("Risk flag"));
        if (!Set.of("OPEN", "INVESTIGATING", "RESOLVED").contains(status)) throw ApiException.badRequest("BAD_STATUS", "Unknown status");
        if ("RESOLVED".equals(status)) requireReason(note);
        f.setStatus(status);
        f.setResolutionNote(note);
        if ("RESOLVED".equals(status)) { f.setResolvedBy(admin.id()); f.setResolvedAt(Instant.now()); }
        riskFlags.save(f);
        record(admin, "RISK_FLAG", f.getId(), "RISK_FLAG_" + status, note);
    }
}
