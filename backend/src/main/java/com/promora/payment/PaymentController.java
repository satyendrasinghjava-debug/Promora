package com.promora.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.promora.common.ApiException;
import com.promora.common.Sql;
import com.promora.security.Current;
import com.promora.subscription.SubscriptionPlanRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments")
@Tag(name = "Payments")
public class PaymentController {
    private final PaymentService payments;
    private final ObjectMapper mapper;
    private final Sql sql;

    public PaymentController(PaymentService payments, ObjectMapper mapper, Sql sql) {
        this.payments = payments; this.mapper = mapper; this.sql = sql;
    }

    @GetMapping("/config")
    public Map<String, Object> config() { return payments.config(); }

    @PostMapping("/campaigns/{campaignId}/order")
    public Map<String, Object> campaignOrder(@PathVariable UUID campaignId, @RequestHeader("Idempotency-Key") @Size(min = 8, max = 80) String key) {
        return payments.createCampaignOrder(campaignId, key);
    }

    public record SubscribeRequest(@NotBlank String planCode) {}

    @PostMapping("/subscriptions/order")
    public Map<String, Object> subscriptionOrder(@Valid @RequestBody SubscribeRequest req, @RequestHeader("Idempotency-Key") @Size(min = 8, max = 80) String key) {
        return payments.createSubscriptionOrder(req.planCode(), key);
    }

    public record VerifyRequest(@NotNull UUID transactionId, @NotBlank String paymentId, @NotBlank String signature) {}

    @PostMapping("/verify")
    public Map<String, Object> verify(@Valid @RequestBody VerifyRequest req) { return payments.verify(req.transactionId(), req.paymentId(), req.signature()); }

    @PostMapping("/sandbox/{transactionId}/complete")
    public Map<String, Object> sandbox(@PathVariable UUID transactionId) { return payments.simulateSandboxPayment(transactionId); }

    @GetMapping("/subscription")
    public Map<String, Object> mySubscription() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("current", sql.one("""
                SELECT s.id, s.status, s.started_at, s.expires_at, p.code, p.name, p.price_paise, p.platform_fee_bps, p.max_active_campaigns
                FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
                WHERE s.user_id = :u AND s.status = 'ACTIVE' AND s.expires_at > now() ORDER BY s.expires_at DESC LIMIT 1""", Map.of("u", Current.user().id())));
        m.put("feeBps", payments.feeBps(Current.user().id()));
        return m;
    }

    /** Razorpay webhook. Public endpoint; authenticity comes from the HMAC signature over the raw body. */
    @PostMapping("/webhook/razorpay")
    public Map<String, Object> webhook(@RequestBody String rawBody, @RequestHeader(name = "X-Razorpay-Signature", required = false) String signature,
                                       @RequestHeader(name = "X-Razorpay-Event-Id", required = false) String eventId) {
        if (signature == null) throw ApiException.badRequest("BAD_SIGNATURE", "Missing signature");
        JsonNode json;
        try { json = mapper.readTree(rawBody); } catch (Exception e) { throw ApiException.badRequest("BAD_REQUEST", "Invalid JSON"); }
        payments.handleWebhook(rawBody, signature, eventId, json);
        return Map.of("received", true);
    }
}
