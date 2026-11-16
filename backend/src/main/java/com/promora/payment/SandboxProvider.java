package com.promora.payment;

import com.promora.common.Util;

/**
 * Local sandbox used when Razorpay keys are not configured. It moves no money. Payments are confirmed through a
 * clearly labelled "simulate payment" endpoint, and still pass through the same server-side signature check.
 */
public class SandboxProvider implements PaymentProvider {
    private final String secret;

    public SandboxProvider(String secret) { this.secret = secret; }

    public String name() { return "sandbox"; }
    public boolean sandbox() { return true; }
    public String publicKey() { return null; }
    public String createOrder(long amountPaise, String currency, String receipt) { return "sandbox_order_" + Util.randomToken(8); }
    public String sign(String orderId, String paymentId) { return Util.hmacSha256Hex(secret, orderId + "|" + paymentId); }
    public boolean verifyPaymentSignature(String orderId, String paymentId, String signature) { return Util.constantTimeEquals(sign(orderId, paymentId), signature); }
    public boolean verifyWebhookSignature(String rawBody, String signature) { return Util.constantTimeEquals(Util.hmacSha256Hex(secret, rawBody), signature); }
    public String refund(String paymentId, long amountPaise) { return "sandbox_refund_" + Util.randomToken(8); }
}
