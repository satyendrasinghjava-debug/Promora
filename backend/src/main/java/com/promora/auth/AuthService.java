package com.promora.auth;

import com.promora.analytics.EventService;
import com.promora.audit.AuditService;
import com.promora.auth.AuthDtos.*;
import com.promora.common.ApiException;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import com.promora.notification.NotificationService;
import com.promora.referral.ReferralService;
import com.promora.security.JwtService;
import com.promora.user.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class AuthService {
    private final UserRepository users;
    private final UserProfileRepository profiles;
    private final RefreshTokenRepository refreshTokens;
    private final AuthTokenRepository authTokens;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final PromoraProperties props;
    private final NotificationService notifications;
    private final ReferralService referrals;
    private final EventService events;
    private final AuditService audit;
    private final UserService userService;

    public AuthService(UserRepository users, UserProfileRepository profiles, RefreshTokenRepository refreshTokens, AuthTokenRepository authTokens,
                       PasswordEncoder encoder, JwtService jwt, PromoraProperties props, NotificationService notifications,
                       ReferralService referrals, EventService events, AuditService audit, UserService userService) {
        this.users = users; this.profiles = profiles; this.refreshTokens = refreshTokens; this.authTokens = authTokens;
        this.encoder = encoder; this.jwt = jwt; this.props = props; this.notifications = notifications;
        this.referrals = referrals; this.events = events; this.audit = audit; this.userService = userService;
    }

    /** Result of a successful sign-in: the access token goes in the body, the refresh token in an HttpOnly cookie. */
    public record Session(String accessToken, String refreshToken, Map<String, Object> user, String devVerificationToken) {}

    @Transactional
    public Session register(RegisterRequest req, String ip) {
        if (users.findByEmail(req.email().trim()).isPresent())
            throw ApiException.conflict("EMAIL_TAKEN", "An account with this email already exists");
        User u = new User();
        u.setEmail(req.email().trim().toLowerCase());
        u.setPasswordHash(encoder.encode(req.password()));
        u.setFullName(req.fullName().trim());
        u.getRoles().add("USER");
        u.setSignupIpHash(Util.sha256(props.hashSalt() + ip));
        u.setUtmSource(Util.blankToNull(req.utmSource()));
        u.setUtmMedium(Util.blankToNull(req.utmMedium()));
        u.setUtmCampaign(Util.blankToNull(req.utmCampaign()));
        users.save(u);
        UserProfile p = new UserProfile();
        p.setUserId(u.getId());
        p.setMarketingConsent(req.marketingConsent());
        p.setTermsAcceptedAt(Instant.now());
        profiles.save(p);
        referrals.ensureCode(u.getId());
        referrals.attribute(u, req.referralCode());
        String verifyToken = issueAuthToken(u, "EMAIL_VERIFY", 48);
        notifications.email(u.getEmail(), "Verify your Promora email",
                "Welcome to Promora.\n\nConfirm your email address:\n" + props.publicUrl() + "/verify-email?token=" + verifyToken + "\n\nThe link is valid for 48 hours.");
        notifications.notify(u.getId(), "WELCOME", "Welcome to Promora", "Verify your email and complete your profile to get started.", "/dashboard/settings");
        Map<String, Object> eventProps = new LinkedHashMap<>();
        eventProps.put("referred", Util.blankToNull(req.referralCode()) != null);
        events.track("signup_completed", u.getId(), null, eventProps, null, u.getUtmSource(), u.getUtmMedium(), u.getUtmCampaign());
        audit.log(u.getId(), u.getEmail(), "USER_REGISTERED", "USER", u.getId(), null);
        return session(u, props.auth().exposeDevTokens() ? verifyToken : null);
    }

    @Transactional
    public Session login(LoginRequest req) {
        User u = users.findByEmail(req.email().trim()).orElse(null);
        // Same error for unknown email and wrong password, so accounts cannot be enumerated.
        if (u == null || !encoder.matches(req.password(), u.getPasswordHash()))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Email or password is incorrect");
        if (!"ACTIVE".equals(u.getStatus()))
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_SUSPENDED", "This account is suspended. Contact support.");
        u.setLastLoginAt(Instant.now());
        users.save(u);
        return session(u, null);
    }

    private Session session(User u, String devToken) {
        String refresh = Util.randomToken(32);
        RefreshToken rt = new RefreshToken();
        rt.setUserId(u.getId());
        rt.setTokenHash(Util.sha256(refresh));
        rt.setExpiresAt(Instant.now().plus(props.jwt().refreshDays(), ChronoUnit.DAYS));
        refreshTokens.save(rt);
        return new Session(jwt.issue(u.getId(), u.getTokenVersion()), refresh, userService.describe(u), devToken);
    }

    /** Rotates the refresh token. A revoked or unknown token signs the user out everywhere it was issued. */
    @Transactional(noRollbackFor = ApiException.class)
    public Session refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank())
            throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_SESSION", "Please sign in");
        RefreshToken rt = refreshTokens.findByTokenHash(Util.sha256(refreshToken)).orElse(null);
        if (rt == null) throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_SESSION", "Please sign in");
        if (rt.getRevokedAt() != null) {
            // Reuse of a rotated token suggests theft: revoke every session of this user.
            revokeAll(rt.getUserId());
            throw new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_REVOKED", "Please sign in again");
        }
        if (rt.getExpiresAt().isBefore(Instant.now())) throw new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_EXPIRED", "Please sign in again");
        User u = users.findById(rt.getUserId()).orElse(null);
        if (u == null || !"ACTIVE".equals(u.getStatus())) throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_SESSION", "Please sign in");
        rt.setRevokedAt(Instant.now());
        refreshTokens.save(rt);
        return session(u, null);
    }

    @Transactional
    public void logout(String refreshToken) {
        if (refreshToken == null) return;
        refreshTokens.findByTokenHash(Util.sha256(refreshToken)).ifPresent(rt -> {
            if (rt.getRevokedAt() == null) { rt.setRevokedAt(Instant.now()); refreshTokens.save(rt); }
        });
    }

    public void revokeAll(UUID userId) {
        refreshTokens.findByUserIdAndRevokedAtIsNull(userId).forEach(t -> { t.setRevokedAt(Instant.now()); refreshTokens.save(t); });
    }

    private String issueAuthToken(User u, String purpose, int hours) {
        String token = Util.randomToken(24);
        AuthToken t = new AuthToken();
        t.setUserId(u.getId());
        t.setPurpose(purpose);
        t.setTokenHash(Util.sha256(token));
        t.setExpiresAt(Instant.now().plus(hours, ChronoUnit.HOURS));
        authTokens.save(t);
        return token;
    }

    private AuthToken consume(String token, String purpose) {
        AuthToken t = authTokens.findByTokenHash(Util.sha256(token)).orElse(null);
        if (t == null || !purpose.equals(t.getPurpose()) || t.getUsedAt() != null || t.getExpiresAt().isBefore(Instant.now()))
            throw ApiException.badRequest("INVALID_TOKEN", "This link is invalid or has expired");
        t.setUsedAt(Instant.now());
        authTokens.save(t);
        return t;
    }

    @Transactional
    public void verifyEmail(String token) {
        AuthToken t = consume(token, "EMAIL_VERIFY");
        User u = users.findById(t.getUserId()).orElseThrow();
        u.setEmailVerified(true);
        users.save(u);
        audit.log(u.getId(), u.getEmail(), "EMAIL_VERIFIED", "USER", u.getId(), null);
    }

    /** Returns the raw token only so the caller can expose it in dev mode; null when already verified. */
    @Transactional
    public String resendVerification(UUID userId) {
        User u = users.findById(userId).orElseThrow();
        if (u.isEmailVerified()) return null;
        String token = issueAuthToken(u, "EMAIL_VERIFY", 48);
        notifications.email(u.getEmail(), "Verify your Promora email", "Confirm your email address:\n" + props.publicUrl() + "/verify-email?token=" + token);
        return props.auth().exposeDevTokens() ? token : null;
    }

    /** Always succeeds from the caller's point of view, so email addresses cannot be probed. */
    @Transactional
    public String forgotPassword(String email) {
        User u = users.findByEmail(email.trim()).orElse(null);
        if (u == null || !"ACTIVE".equals(u.getStatus())) return null;
        String token = issueAuthToken(u, "PASSWORD_RESET", 1);
        notifications.email(u.getEmail(), "Reset your Promora password",
                "Use this link to choose a new password:\n" + props.publicUrl() + "/reset-password?token=" + token + "\n\nThe link is valid for 1 hour. If you did not ask for this, ignore this email.");
        return props.auth().exposeDevTokens() ? token : null;
    }

    @Transactional
    public void resetPassword(ResetRequest req) {
        AuthToken t = consume(req.token(), "PASSWORD_RESET");
        User u = users.findById(t.getUserId()).orElseThrow();
        setPassword(u, req.password());
        audit.log(u.getId(), u.getEmail(), "PASSWORD_RESET", "USER", u.getId(), null);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User u = users.findById(userId).orElseThrow();
        if (!encoder.matches(req.currentPassword(), u.getPasswordHash()))
            throw ApiException.badRequest("WRONG_PASSWORD", "Current password is incorrect");
        setPassword(u, req.newPassword());
        audit.log(u.getId(), u.getEmail(), "PASSWORD_CHANGED", "USER", u.getId(), null);
    }

    private void setPassword(User u, String raw) {
        u.setPasswordHash(encoder.encode(raw));
        u.setTokenVersion(u.getTokenVersion() + 1); // invalidates every access token already issued
        u.setUpdatedAt(Instant.now());
        users.save(u);
        revokeAll(u.getId());
    }
}
