package com.promora.payment;

/** Payment gateway abstraction. Implementations: Razorpay (live/test keys) and a local sandbox used when no keys are set. */
public interface PaymentProvider {
    String name();
    /** True only for the built-in sandbox, which moves no real money. */
    boolean sandbox();
    /** Public key the browser needs to open checkout; null for the sandbox. */
    String publicKey();
    /** Creates an order for the amount and returns the provider's order id. */
    String createOrder(long amountPaise, String currency, String receipt);
    /** Verifies the checkout signature returned to the browser. */
    boolean verifyPaymentSignature(String orderId, String paymentId, String signature);
    /** Verifies a webhook body against its signature header. */
    boolean verifyWebhookSignature(String rawBody, String signature);
    /** Refunds part of a captured payment and returns the provider's refund id. */
    String refund(String paymentId, long amountPaise);
}
