package com.promora.payment;

import com.promora.admin.SettingsService;
import com.promora.audit.AuditService;
import com.promora.campaign.Campaign;
import com.promora.campaign.CampaignRepository;
import com.promora.campaign.CampaignStatus;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.notification.NotificationService;
import com.promora.security.AuthUser;
import com.promora.security.Current;
import com.promora.subscription.Subscription;
import com.promora.subscription.SubscriptionPlan;
import com.promora.subscription.SubscriptionPlanRepository;
import com.promora.subscription.SubscriptionRepository;
import com.promora.user.User;
import com.promora.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class PaymentService {
    private final PaymentProvider provider;
    private final TransactionRepository transactions;
    private final CampaignRepository campaigns;
    private final UserRepository users;
    private final SubscriptionPlanRepository plans;
    private final SubscriptionRepository subscriptions;
    private final SettingsService settings;
    private final NotificationService notifications;
    private final AuditService audit;
    private final JdbcTemplate jdbc;

    public PaymentService(PaymentProvider provider, TransactionRepository transactions, CampaignRepository campaigns, UserRepository users,
                          SubscriptionPlanRepository plans, SubscriptionRepository subscriptions, SettingsService settings,
                          NotificationService notifications, AuditService audit, JdbcTemplate jdbc) {
        this.provider = provider; this.transactions = transactions; this.campaigns = campaigns; this.users = users; this.plans = plans;
        this.subscriptions = subscriptions; this.settings = settings; this.notifications = notifications; this.audit = audit; this.jdbc = jdbc;
    }

    public Map<String, Object> config() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("provider", provider.name());
        m.put("sandbox", provider.sandbox());
        m.put("keyId", provider.publicKey());
        m.put("message", provider.sandbox()
                ? "Sandbox mode: Razorpay keys are not configured, so no real money moves. Payments are simulated for testing."
                : "Payments are processed by Razorpay.");
        return m;
    }

    /** Fee rate of the user's active plan, falling back to the platform default. */
    public long feeBps(UUID userId) {
        return subscriptions.findFirstByUserIdAndStatusAndExpiresAtAfterOrderByExpiresAtDesc(userId, "ACTIVE", Instant.now())
                .flatMap(s -> plans.findById(s.getPlanId())).map(p -> (long) p.getPlatformFeeBps())
                .orElseGet(() -> settings.getLong("commission.platform_fee_bps", 1500));
    }

    /** Price breakdown, always computed on the server: reward budget + platform fee (less promo credits) + GST on the fee. */
    public record Breakdown(long basePaise, long feePaise, long creditPaise, long taxPaise, long totalPaise) {}

    public Breakdown fundingBreakdown(Campaign c, User u) {
        long base = c.getBudgetPaise() - c.getFundedPaise();
        if (base <= 0) throw ApiException.conflict("ALREADY_FUNDED", "This campaign is already fully funded");
        long grossFee = Math.round(base * feeBps(u.getId()) / 10000.0);
        long credit = Math.min(u.getPromoCreditsPaise(), grossFee);
        long fee = grossFee - credit;
        long tax = Math.round(fee * settings.getLong("commission.gst_bps", 1800) / 10000.0);
        return new Breakdown(base, fee, credit, tax, base + fee + tax);
    }

    private Map<String, Object> orderResponse(Transaction t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("transactionId", t.getId());
        m.put("status", t.getStatus());
        m.put("provider", t.getProvider());
        m.put("sandbox", provider.sandbox());
        m.put("orderId", t.getProviderOrderId());
        m.put("keyId", provider.publicKey());
        m.put("amountPaise", t.getAmountPaise());
        m.put("currency", t.getCurrency());
        m.put("breakdown", Map.of("basePaise", t.getBasePaise(), "feePaise", t.getFeePaise(), "creditPaise", t.getCreditPaise(), "taxPaise", t.getTaxPaise(), "totalPaise", t.getAmountPaise()));
        m.put("description", t.getDescription());
        return m;
    }

    @Transactional
    public Map<String, Object> createCampaignOrder(UUID campaignId, String idempotencyKey) {
        AuthUser au = Current.user();
        Transaction existing = transactions.findByUserIdAndIdempotencyKey(au.id(), idempotencyKey).orElse(null);
        if (existing != null) return orderResponse(existing);
        Campaign c = campaigns.findById(campaignId).orElseThrow(() -> ApiException.notFound("Campaign"));
        if (!c.getOwnerUserId().equals(au.id())) throw ApiException.notFound("Campaign");
        if (!CampaignStatus.APPROVED.equals(c.getStatus()) && !CampaignStatus.ACTIVE.equals(c.getStatus()) && !CampaignStatus.PAUSED.equals(c.getStatus()))
            throw ApiException.conflict("NOT_FUNDABLE", "A campaign can be funded after it is approved");
        User u = users.findById(au.id()).orElseThrow();
        Breakdown b = fundingBreakdown(c, u);
        Transaction t = new Transaction();
        t.setUserId(au.id());
        t.setCampaignId(c.getId());
        t.setType("CAMPAIGN_FUNDING");
        t.setBasePaise(b.basePaise());
        t.setFeePaise(b.feePaise());
        t.setCreditPaise(b.creditPaise());
        t.setTaxPaise(b.taxPaise());
        t.setAmountPaise(b.totalPaise());
        t.setProvider(provider.name());
        t.setIdempotencyKey(idempotencyKey);
        t.setDescription("Campaign funding: " + Util.truncate(c.getTitle(), 200));
        transactions.save(t);
        t.setProviderOrderId(provider.createOrder(t.getAmountPaise(), t.getCurrency(), t.getId().toString()));
        transactions.save(t);
        return orderResponse(t);
    }

    @Transactional
    public Map<String, Object> createSubscriptionOrder(String planCode, String idempotencyKey) {
        AuthUser au = Current.user();
        Transaction existing = transactions.findByUserIdAndIdempotencyKey(au.id(), idempotencyKey).orElse(null);
        if (existing != null) return orderResponse(existing);
        SubscriptionPlan plan = plans.findByCode(planCode).filter(SubscriptionPlan::isActive).orElseThrow(() -> ApiException.notFound("Plan"));
        if (plan.getPricePaise() == 0) throw ApiException.unprocessable("FREE_PLAN", "The Free plan needs no payment");
        long tax = Math.round(plan.getPricePaise() * settings.getLong("commission.gst_bps", 1800) / 10000.0);
        Transaction t = new Transaction();
        t.setUserId(au.id());
        t.setType("SUBSCRIPTION");
        t.setBasePaise(plan.getPricePaise());
        t.setTaxPaise(tax);
        t.setAmountPaise(plan.getPricePaise() + tax);
        t.setProvider(provider.name());
        t.setIdempotencyKey(idempotencyKey);
        t.setReferenceId(plan.getId());
        t.setDescription("Subscription: " + plan.getName() + " (1 month)");
        transactions.save(t);
        t.setProviderOrderId(provider.createOrder(t.getAmountPaise(), t.getCurrency(), t.getId().toString()));
        transactions.save(t);
        return orderResponse(t);
    }

    /** Browser callback after checkout. The payment only counts when the provider signature verifies on the server. */
    @Transactional
    public Map<String, Object> verify(UUID transactionId, String paymentId, String signature) {
        Transaction t = transactions.findById(transactionId).orElseThrow(() -> ApiException.notFound("Transaction"));
        if (!t.getUserId().equals(Current.user().id())) throw ApiException.notFound("Transaction");
        if (!provider.verifyPaymentSignature(t.getProviderOrderId(), paymentId, signature))
            throw ApiException.badRequest("BAD_SIGNATURE", "Payment could not be verified");
        return orderResponse(markPaid(t.getId(), paymentId));
    }

    /** Sandbox only: simulates a successful checkout. Refused whenever a real provider is configured. */
    @Transactional
    public Map<String, Object> simulateSandboxPayment(UUID transactionId) {
        if (!(provider instanceof SandboxProvider sandbox))
            throw ApiException.forbidden("Simulated payments are only available in sandbox mode");
        Transaction t = transactions.findById(transactionId).orElseThrow(() -> ApiException.notFound("Transaction"));
        if (!t.getUserId().equals(Current.user().id())) throw ApiException.notFound("Transaction");
        String paymentId = "sandbox_pay_" + Util.randomToken(8);
        return verify(transactionId, paymentId, sandbox.sign(t.getProviderOrderId(), paymentId));
    }

    /** Applies a captured payment exactly once, under a row lock. Safe to call from both the browser callback and the webhook. */
    @Transactional
    public Transaction markPaid(UUID transactionId, String paymentId) {
        Transaction t = transactions.lockById(transactionId).orElseThrow(() -> ApiException.notFound("Transaction"));
        if ("PAID".equals(t.getStatus()) || "REFUNDED".equals(t.getStatus())) return t;
        t.setStatus("PAID");
        t.setProviderPaymentId(paymentId);
        t.setUpdatedAt(Instant.now());
        transactions.save(t);
        if ("CAMPAIGN_FUNDING".equals(t.getType())) {
            Campaign c = campaigns.lockById(t.getCampaignId()).orElseThrow();
            c.setFundedPaise(c.getFundedPaise() + t.getBasePaise());
            if (CampaignStatus.APPROVED.equals(c.getStatus())) c.setStatus(CampaignStatus.ACTIVE);
            c.setUpdatedAt(Instant.now());
            campaigns.save(c);
            if (t.getCreditPaise() > 0) {
                User u = users.lockById(t.getUserId()).orElseThrow();
                u.setPromoCreditsPaise(Math.max(0, u.getPromoCreditsPaise() - t.getCreditPaise()));
                users.save(u);
            }
            notifications.notify(t.getUserId(), "PAYMENT", "Payment received", "\"" + c.getTitle() + "\" is funded and live.", "/dashboard/advertiser/campaigns/" + c.getId());
        } else if ("SUBSCRIPTION".equals(t.getType()) && !subscriptions.existsByTransactionId(t.getId())) {
            jdbc.update("UPDATE subscriptions SET status = 'CANCELLED' WHERE user_id = ? AND status = 'ACTIVE'", t.getUserId());
            Subscription s = new Subscription();
            s.setUserId(t.getUserId());
            s.setPlanId(t.getReferenceId());
            s.setExpiresAt(Instant.now().plus(30, ChronoUnit.DAYS));
            s.setTransactionId(t.getId());
            subscriptions.save(s);
            notifications.notify(t.getUserId(), "PAYMENT", "Subscription active", t.getDescription(), "/dashboard/billing");
        }
        return t;
    }

    /** Webhook entry point. Signature is verified on the raw body; each provider event id is processed once. */
    @Transactional
    public void handleWebhook(String rawBody, String signature, String eventId, com.fasterxml.jackson.databind.JsonNode json) {
        if (!provider.verifyWebhookSignature(rawBody, signature)) throw ApiException.badRequest("BAD_SIGNATURE", "Invalid webhook signature");
        String type = json.path("event").asText("");
        String id = eventId != null && !eventId.isBlank() ? eventId : Util.sha256(rawBody);
        int inserted = jdbc.update("INSERT INTO webhook_events (provider, event_id, event_type, payload) VALUES (?,?,?,?) ON CONFLICT (provider, event_id) DO NOTHING",
                provider.name(), id, Util.truncate(type, 60), rawBody);
        if (inserted == 0) return; // duplicate delivery
        com.fasterxml.jackson.databind.JsonNode payment = json.path("payload").path("payment").path("entity");
        if (("payment.captured".equals(type) || "order.paid".equals(type)) && payment.hasNonNull("order_id")) {
            transactions.findByProviderOrderId(payment.get("order_id").asText()).ifPresent(t -> markPaid(t.getId(), payment.path("id").asText(null)));
        } else if ("payment.failed".equals(type) && payment.hasNonNull("order_id")) {
            transactions.findByProviderOrderId(payment.get("order_id").asText()).ifPresent(t -> {
                if ("CREATED".equals(t.getStatus())) { t.setStatus("FAILED"); t.setUpdatedAt(Instant.now()); transactions.save(t); }
            });
        }
    }

    /** Admin refund of the unspent part of a campaign funding payment. */
    @Transactional
    public Transaction refundUnspent(UUID transactionId, String reason) {
        AuthUser admin = Current.user();
        if (reason == null || reason.isBlank()) throw ApiException.unprocessable("REASON_REQUIRED", "Give a reason for the refund");
        Transaction t = transactions.lockById(transactionId).orElseThrow(() -> ApiException.notFound("Transaction"));
        if (!"CAMPAIGN_FUNDING".equals(t.getType()) || !"PAID".equals(t.getStatus()))
            throw ApiException.conflict("NOT_REFUNDABLE", "Only paid campaign funding payments can be refunded");
        Campaign c = campaigns.lockById(t.getCampaignId()).orElseThrow();
        if (CampaignStatus.ACTIVE.equals(c.getStatus())) throw ApiException.conflict("CAMPAIGN_ACTIVE", "Pause, cancel or end the campaign before refunding");
        long refundable = Math.min(t.getBasePaise(), c.getFundedPaise() - c.getSpentPaise());
        if (refundable <= 0) throw ApiException.unprocessable("NOTHING_TO_REFUND", "There is no unspent budget to refund");
        String refundId = provider.refund(t.getProviderPaymentId(), refundable);
        c.setFundedPaise(c.getFundedPaise() - refundable);
        campaigns.save(c);
        t.setStatus("REFUNDED");
        t.setUpdatedAt(Instant.now());
        transactions.save(t);
        Transaction r = new Transaction();
        r.setUserId(t.getUserId());
        r.setCampaignId(c.getId());
        r.setType("REFUND");
        r.setAmountPaise(refundable);
        r.setBasePaise(refundable);
        r.setStatus("PAID");
        r.setProvider(provider.name());
        r.setProviderPaymentId(refundId);
        r.setIdempotencyKey("refund-" + t.getId());
        r.setReferenceId(t.getId());
        r.setDescription("Refund of unspent budget: " + Util.truncate(reason, 200));
        transactions.save(r);
        notifications.notify(t.getUserId(), "PAYMENT", "Refund issued", "₹" + (refundable / 100) + " of unspent budget for \"" + c.getTitle() + "\".", "/dashboard/billing");
        audit.log(admin, "REFUND_ISSUED", "TRANSACTION", t.getId(), reason);
        return r;
    }
}
