package com.promora.auth;

import jakarta.validation.constraints.*;

public final class AuthDtos {
    private AuthDtos() {}

    public static final String PASSWORD_RULE = "^(?=.*[A-Za-z])(?=.*\\d).{8,72}$";
    public static final String PASSWORD_MESSAGE = "Password must be 8 to 72 characters with at least one letter and one number";

    public record RegisterRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password,
            @NotBlank @Size(min = 2, max = 120) String fullName,
            @AssertTrue(message = "You must accept the Terms and Privacy Policy") boolean acceptTerms,
            boolean marketingConsent,
            @Size(max = 16) String referralCode,
            @Size(max = 100) String utmSource, @Size(max = 100) String utmMedium, @Size(max = 100) String utmCampaign) {}

    public record LoginRequest(@NotBlank @Email String email, @NotBlank String password) {}
    public record TokenRequest(@NotBlank String token) {}
    public record EmailRequest(@NotBlank @Email String email) {}
    public record ResetRequest(@NotBlank String token,
                               @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String password) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Pattern(regexp = PASSWORD_RULE, message = PASSWORD_MESSAGE) String newPassword) {}
}
