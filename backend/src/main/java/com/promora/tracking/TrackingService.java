package com.promora.tracking;

import com.promora.admin.SettingsService;
import com.promora.analytics.EventService;
import com.promora.campaign.Campaign;
import com.promora.campaign.CampaignRepository;
import com.promora.campaign.CampaignStatus;
import com.promora.commission.Commission;
import com.promora.commission.CommissionService;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import com.promora.moderation.RiskService;
import com.promora.notification.NotificationService;
import com.promora.user.User;
import com.promora.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Map;
import java.util.regex.Pattern;

@Service
public class TrackingService {
    static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    /** Known crawlers, link-preview fetchers, HTTP libraries and headless browsers. */
    static final Pattern BOT = Pattern.compile(
            "bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|slack|discord|curl|wget|python|java/|okhttp|go-http|axios|node-fetch|headless|phantom|scrapy|httpclient|postman|lighthouse",
            Pattern.CASE_INSENSITIVE);

    private final TrackingLinkRepository links;
    private final ClickEventRepository clicks;
    private final CampaignRepository campaigns;
    private final UserRepository users;
    private final CommissionService commissions;
    private final SettingsService settings;
    private final RiskService risk;
    private final NotificationService notifications;
    private final EventService events;
    private final PromoraProperties props;
    private final JdbcTemplate jdbc;

    public TrackingService(TrackingLinkRepository links, ClickEventRepository clicks, CampaignRepository campaigns, UserRepository users,
                           CommissionService commissions, SettingsService settings, RiskService risk, NotificationService notifications,
                           EventService events, PromoraProperties props, JdbcTemplate jdbc) {
        this.links = links; this.clicks = clicks; this.campaigns = campaigns; this.users = users; this.commissions = commissions;
        this.settings = settings; this.risk = risk; this.notifications = notifications; this.events = events; this.props = props; this.jdbc = jdbc;
    }

    public record ClickResult(String redirectUrl, ClickEvent click) {}

    public static boolean looksLikeBot(String userAgent) {
        return userAgent == null || userAgent.isBlank() || userAgent.length() < 20 || BOT.matcher(userAgent).find();
    }

    /**
     * Records a raw click and decides whether it is a qualified click. A click is qualified only when the campaign is
     * live with budget, the caller does not look automated, it is the first click of that visitor on that campaign today,
     * the IP is under the velocity limit, and the visitor is not the promoter. Raw page refreshes are stored but never paid.
     */
    @Transactional
    public ClickResult handleClick(String code, String ip, String userAgent, String referer, String source) {
        TrackingLink link = links.findByCode(code).orElseThrow(() -> ApiException.notFound("Link"));
        Campaign campaign = campaigns.lockById(link.getCampaignId()).orElseThrow();
        String ipHash = Util.sha256(props.hashSalt() + ip);
        String visitorHash = Util.sha256(props.hashSalt() + ip + "|" + (userAgent == null ? "" : userAgent));
        LocalDate today = LocalDate.now(IST);

        String reject = null;
        if (!link.isActive()) reject = "LINK_INACTIVE";
        else if (!CampaignStatus.ACTIVE.equals(campaign.getStatus())) reject = "CAMPAIGN_NOT_ACTIVE";
        else if (campaign.getStartDate() != null && today.isBefore(campaign.getStartDate())) reject = "NOT_STARTED";
        else if (campaign.getEndDate() != null && today.isAfter(campaign.getEndDate())) reject = "ENDED";
        else if (looksLikeBot(userAgent)) reject = "BOT";
        else {
            User promoter = users.findById(link.getPromoterUserId()).orElse(null);
            if (promoter != null && ipHash.equals(promoter.getSignupIpHash())) reject = "SELF_CLICK";
        }
        if (reject == null) {
            Long sameVisitor = jdbc.queryForObject("SELECT count(*) FROM click_events WHERE campaign_id = ? AND visitor_hash = ? AND click_day = ? AND qualified",
                    Long.class, campaign.getId(), visitorHash, today);
            if (sameVisitor != null && sameVisitor > 0) reject = "DUPLICATE";
        }
        if (reject == null) {
            long limit = settings.getLong("tracking.max_clicks_per_ip_per_hour", 20);
            Long fromIp = jdbc.queryForObject("SELECT count(*) FROM click_events WHERE campaign_id = ? AND ip_hash = ? AND created_at > now() - interval '1 hour'",
                    Long.class, campaign.getId(), ipHash);
            if (fromIp != null && fromIp >= limit) {
                reject = "VELOCITY";
                risk.flag("SUSPICIOUS_CLICKS", link.getPromoterUserId(), "TRACKING_LINK", link.getId().toString(), "HIGH",
                        "More than " + limit + " clicks in an hour from one IP address on campaign \"" + campaign.getTitle() + "\"",
                        "clicks:" + link.getId() + ":" + ipHash + ":" + today);
            }
        }
        if (reject == null && "CPC".equals(campaign.getRewardType()) && campaign.getFundedPaise() - campaign.getSpentPaise() < campaign.getRewardPaise())
            reject = "BUDGET_EXHAUSTED";

        ClickEvent click = new ClickEvent();
        click.setTrackingLinkId(link.getId());
        click.setCampaignId(campaign.getId());
        click.setPromoterUserId(link.getPromoterUserId());
        click.setVisitorHash(visitorHash);
        click.setIpHash(ipHash);
        click.setUserAgent(Util.truncate(userAgent, 400));
        click.setReferer(Util.truncate(referer, 500));
        click.setSource(Util.truncate(source, 100));
        click.setClickDay(today);
        click.setQualified(reject == null);
        click.setRejectReason(reject);
        clicks.save(click);

        if (reject == null) {
            events.track("qualified_click", link.getPromoterUserId(), Map.of("campaignId", campaign.getId().toString()));
            if ("CPC".equals(campaign.getRewardType())) {
                ConversionEvent conv = new ConversionEvent();
                conv.setCampaignId(campaign.getId());
                conv.setTrackingLinkId(link.getId());
                conv.setPromoterUserId(link.getPromoterUserId());
                conv.setClickEventId(click.getId());
                conv.setType("QUALIFIED_CLICK");
                conv.setDedupeKey("click:" + visitorHash + ":" + today);
                commissions.record(campaign, conv);
            }
        }
        return new ClickResult(destination(campaign, link, click), click);
    }

    private String destination(Campaign c, TrackingLink link, ClickEvent click) {
        boolean live = CampaignStatus.ACTIVE.equals(c.getStatus());
        if ("CPL".equals(c.getRewardType()) || c.getLandingUrl() == null || !live)
            return props.publicUrl() + "/campaigns/" + c.getId() + (live && "CPL".equals(c.getRewardType()) ? "?lead=" + link.getCode() + "&click=" + click.getId() : "");
        // The destination always comes from the stored campaign, never from the request, so this is not an open redirect.
        String sep = c.getLandingUrl().contains("?") ? "&" : "?";
        return c.getLandingUrl() + sep + "utm_source=promora&utm_medium=referral&utm_campaign=" + c.getSlug() + "&pm_click=" + click.getId();
    }

    public record LeadRequest(String code, String name, String email, String phone) {}

    /** Records a lead for a pay-per-lead campaign. One lead per email address per campaign. */
    @Transactional
    public boolean recordLead(LeadRequest req, String ip, String userAgent) {
        TrackingLink link = links.findByCode(req.code()).orElseThrow(() -> ApiException.notFound("Link"));
        Campaign campaign = campaigns.lockById(link.getCampaignId()).orElseThrow();
        if (!"CPL".equals(campaign.getRewardType())) throw ApiException.unprocessable("NOT_LEAD_CAMPAIGN", "This campaign does not collect leads");
        if (!CampaignStatus.ACTIVE.equals(campaign.getStatus()) || !link.isActive())
            throw ApiException.conflict("CAMPAIGN_NOT_OPEN", "This campaign is not accepting enquiries right now");
        if (looksLikeBot(userAgent)) throw ApiException.unprocessable("REJECTED", "This enquiry could not be accepted");
        String email = req.email().trim().toLowerCase();
        String dedupe = "lead:" + Util.sha256(email);
        ConversionEvent conv = new ConversionEvent();
        conv.setCampaignId(campaign.getId());
        conv.setTrackingLinkId(link.getId());
        conv.setPromoterUserId(link.getPromoterUserId());
        conv.setType("LEAD");
        conv.setDedupeKey(dedupe);
        conv.setLeadName(req.name().trim());
        conv.setLeadEmail(email);
        conv.setLeadPhone(Util.blankToNull(req.phone()));
        User promoter = users.findById(link.getPromoterUserId()).orElse(null);
        if (promoter != null && (email.equalsIgnoreCase(promoter.getEmail()) || Util.sha256(props.hashSalt() + ip).equals(promoter.getSignupIpHash()))) {
            risk.flag("DUPLICATE_CONVERSION", promoter.getId(), "TRACKING_LINK", link.getId().toString(), "MEDIUM",
                    "A lead was submitted by the promoter or from the promoter's own network", "selflead:" + link.getId());
            return false;
        }
        Commission c = commissions.record(campaign, conv);
        if (c == null) {
            if (jdbc.queryForObject("SELECT count(*) FROM conversion_events WHERE campaign_id = ? AND dedupe_key = ?", Long.class, campaign.getId(), dedupe) > 0)
                risk.flag("DUPLICATE_CONVERSION", link.getPromoterUserId(), "CAMPAIGN", campaign.getId().toString(), "LOW",
                        "Repeated lead submission with the same email on \"" + campaign.getTitle() + "\"", "duplead:" + campaign.getId() + ":" + dedupe);
            return false;
        }
        events.track("lead_generated", link.getPromoterUserId(), Map.of("campaignId", campaign.getId().toString()));
        notifications.notify(campaign.getOwnerUserId(), "CONVERSION", "New lead", "\"" + campaign.getTitle() + "\" received a new enquiry.",
                "/dashboard/advertiser/campaigns/" + campaign.getId());
        notifications.notify(link.getPromoterUserId(), "CONVERSION", "You generated a lead", "\"" + campaign.getTitle() + "\"", "/dashboard/promoter/earnings");
        return true;
    }
}
