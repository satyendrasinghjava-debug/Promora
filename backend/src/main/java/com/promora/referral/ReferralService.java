package com.promora.referral;

import com.promora.admin.SettingsService;
import com.promora.analytics.EventService;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.moderation.RiskService;
import com.promora.notification.NotificationService;
import com.promora.security.AuthUser;
import com.promora.user.User;
import com.promora.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class ReferralService {
    private final ReferralCodeRepository codes;
    private final ReferralRepository referrals;
    private final ReferralRewardRepository rewards;
    private final UserRepository users;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final EventService events;
    private final RiskService risk;
    private final JdbcTemplate jdbc;

    public ReferralService(ReferralCodeRepository codes, ReferralRepository referrals, ReferralRewardRepository rewards, UserRepository users,
                           SettingsService settings, NotificationService notifications, EventService events, RiskService risk, JdbcTemplate jdbc) {
        this.codes = codes; this.referrals = referrals; this.rewards = rewards; this.users = users;
        this.settings = settings; this.notifications = notifications; this.events = events; this.risk = risk; this.jdbc = jdbc;
    }

    public ReferralCode ensureCode(UUID userId) {
        return codes.findByUserId(userId).orElseGet(() -> {
            ReferralCode c = new ReferralCode();
            c.setUserId(userId);
            c.setCode(Util.randomCode(8).toUpperCase());
            return codes.save(c);
        });
    }

    /** Called during registration. Unknown codes are ignored; self-referral is impossible because the account is new. */
    public void attribute(User newUser, String code) {
        if (code == null || code.isBlank()) return;
        ReferralCode rc = codes.findByCodeIgnoreCase(code.trim()).orElse(null);
        if (rc == null || rc.getUserId().equals(newUser.getId())) return;
        User referrer = users.findById(rc.getUserId()).orElse(null);
        if (referrer == null || !"ACTIVE".equals(referrer.getStatus())) return;
        Referral r = new Referral();
        r.setReferrerUserId(referrer.getId());
        r.setReferredUserId(newUser.getId());
        r.setCode(rc.getCode());
        // Fraud signal: the new account was created from the same network address as the referrer.
        if (newUser.getSignupIpHash() != null && newUser.getSignupIpHash().equals(referrer.getSignupIpHash())) {
            r.setSuspicious(true);
            r.setSuspiciousReason("Sign-up from the same IP address as the referrer");
        }
        Long recent = jdbc.queryForObject("SELECT count(*) FROM referrals WHERE referrer_user_id = ? AND created_at > now() - interval '1 hour'", Long.class, referrer.getId());
        if (recent != null && recent >= 5) {
            r.setSuspicious(true);
            r.setSuspiciousReason("More than 5 referred sign-ups within one hour");
        }
        referrals.save(r);
        if (r.isSuspicious())
            risk.flag("REFERRAL_ABUSE", referrer.getId(), "REFERRAL", r.getId().toString(), "MEDIUM", r.getSuspiciousReason(), "referral:" + r.getId());
    }

    /**
     * Marks a referral as activated when the referred user does something valuable
     * (first approved campaign, or first approved campaign application) and queues a reward for admin approval.
     */
    @Transactional
    public void activate(UUID referredUserId, String type) {
        Referral r = referrals.findByReferredUserId(referredUserId).orElse(null);
        if (r == null || !"PENDING".equals(r.getStatus())) return;
        r.setStatus("ACTIVATED");
        r.setReferredType(type);
        r.setActivatedAt(Instant.now());
        referrals.save(r);
        long amount = settings.getLong("BUSINESS".equals(type) ? "referral.reward_business_paise" : "referral.reward_promoter_paise", 0);
        ReferralReward reward = new ReferralReward();
        reward.setReferralId(r.getId());
        reward.setBeneficiaryUserId(r.getReferrerUserId());
        reward.setAmountPaise(amount);
        rewards.save(reward);
        events.track("referral_activated", r.getReferrerUserId(), Map.of("referralId", r.getId().toString(), "type", type));
        notifications.notify(r.getReferrerUserId(), "REFERRAL", "A referral was activated",
                "Someone you referred became active. Your reward is waiting for review.", "/dashboard/referrals");
        notifications.notifyStaff("referral.manage", "ADMIN_ALERT", "Referral reward awaiting approval", null, "/admin/referrals");
    }

    /** Admin decision. Approval credits promotional credits exactly once. */
    @Transactional
    public void decideReward(UUID rewardId, boolean approve, String note, AuthUser admin) {
        ReferralReward reward = rewards.lockById(rewardId).orElseThrow(() -> ApiException.notFound("Reward"));
        if (!"PENDING_APPROVAL".equals(reward.getStatus())) throw ApiException.conflict("ALREADY_DECIDED", "This reward was already decided");
        if (approve) {
            long max = settings.getLong("referral.max_rewards_per_month", 10);
            Long approvedThisMonth = jdbc.queryForObject("""
                    SELECT count(*) FROM referral_rewards WHERE beneficiary_user_id = ? AND status = 'APPROVED'
                    AND decided_at >= date_trunc('month', now())""", Long.class, reward.getBeneficiaryUserId());
            if (approvedThisMonth != null && approvedThisMonth >= max)
                throw ApiException.unprocessable("MONTHLY_CAP", "This referrer has reached the monthly reward cap");
            User u = users.lockById(reward.getBeneficiaryUserId()).orElseThrow();
            u.setPromoCreditsPaise(u.getPromoCreditsPaise() + reward.getAmountPaise());
            users.save(u);
            notifications.notify(u.getId(), "REFERRAL", "Referral reward approved",
                    "₹" + (reward.getAmountPaise() / 100) + " in promotional credits was added to your account.", "/dashboard/referrals");
        }
        reward.setStatus(approve ? "APPROVED" : "REJECTED");
        reward.setNote(note);
        reward.setDecidedBy(admin.id());
        reward.setDecidedAt(Instant.now());
        rewards.save(reward);
    }
}
