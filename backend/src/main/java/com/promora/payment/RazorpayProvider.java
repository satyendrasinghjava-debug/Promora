package com.promora.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/** Razorpay Orders, signature verification and refunds over its REST API. */
public class RazorpayProvider implements PaymentProvider {
    private final PromoraProperties.Razorpay config;
    private final RestClient client;

    public RazorpayProvider(PromoraProperties.Razorpay config, RestClient.Builder builder) {
        this.config = config;
        String basic = Base64.getEncoder().encodeToString((config.keyId() + ":" + config.keySecret()).getBytes(StandardCharsets.UTF_8));
        this.client = builder.baseUrl("https://api.razorpay.com/v1").defaultHeader("Authorization", "Basic " + basic).build();
    }

    public String name() { return "razorpay"; }
    public boolean sandbox() { return false; }
    public String publicKey() { return config.keyId(); }

    public String createOrder(long amountPaise, String currency, String receipt) {
        try {
            JsonNode res = client.post().uri("/orders").contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("amount", amountPaise, "currency", currency, "receipt", receipt)).retrieve().body(JsonNode.class);
            if (res == null || !res.hasNonNull("id")) throw new RestClientException("No order id in response");
            return res.get("id").asText();
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", "The payment provider could not create the order. Try again.");
        }
    }

    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) {
        return Util.constantTimeEquals(Util.hmacSha256Hex(config.keySecret(), orderId + "|" + paymentId), signature);
    }

    public boolean verifyWebhookSignature(String rawBody, String signature) {
        if (config.webhookSecret() == null || config.webhookSecret().isBlank()) return false;
        return Util.constantTimeEquals(Util.hmacSha256Hex(config.webhookSecret(), rawBody), signature);
    }

    public String refund(String paymentId, long amountPaise) {
        try {
            JsonNode res = client.post().uri("/payments/{id}/refund", paymentId).contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("amount", amountPaise)).retrieve().body(JsonNode.class);
            if (res == null || !res.hasNonNull("id")) throw new RestClientException("No refund id in response");
            return res.get("id").asText();
        } catch (RestClientException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", "The payment provider could not create the refund.");
        }
    }
}
