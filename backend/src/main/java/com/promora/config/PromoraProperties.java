package com.promora.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

@ConfigurationProperties(prefix = "promora")
public record PromoraProperties(String publicUrl, String apiUrl, List<String> corsOrigins, Jwt jwt, boolean cookiesSecure,
                                String hashSalt, Auth auth, RateLimit ratelimit, Redis redis, Mail mail, Storage storage,
                                Payment payment, Ai ai, BootstrapAdmin bootstrapAdmin, boolean seedDemoData) {
    public record Jwt(String secret, int accessMinutes, int refreshDays) {}
    public record Auth(boolean exposeDevTokens) {}
    public record RateLimit(boolean enabled) {}
    public record Redis(boolean enabled) {}
    public record Mail(String from) {}
    public record Storage(String localDir) {}
    public record Payment(Razorpay razorpay) {}
    public record Razorpay(String keyId, String keySecret, String webhookSecret) {
        public boolean configured() { return keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank(); }
    }
    public record Ai(String baseUrl, String apiKey, String model) {
        public boolean configured() { return notBlank(baseUrl) && notBlank(apiKey) && notBlank(model); }
    }
    public record BootstrapAdmin(String email, String password) {}
    private static boolean notBlank(String s) { return s != null && !s.isBlank(); }
}
