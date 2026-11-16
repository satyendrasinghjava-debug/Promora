package com.promora.payment;

import com.promora.config.PromoraProperties;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
public class PaymentConfig {
    @Bean
    PaymentProvider paymentProvider(PromoraProperties props, RestClient.Builder builder) {
        PromoraProperties.Razorpay rzp = props.payment().razorpay();
        if (rzp != null && rzp.configured()) {
            LoggerFactory.getLogger(PaymentConfig.class).info("Payments: Razorpay provider enabled (key {}...)", rzp.keyId().substring(0, Math.min(8, rzp.keyId().length())));
            return new RazorpayProvider(rzp, builder);
        }
        LoggerFactory.getLogger(PaymentConfig.class).warn("Payments: RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set. Using the local SANDBOX provider. No real payments are processed.");
        return new SandboxProvider(props.jwt().secret());
    }
}
