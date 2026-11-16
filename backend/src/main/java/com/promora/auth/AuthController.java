package com.promora.auth;

import com.promora.auth.AuthDtos.*;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication")
public class AuthController {
    static final String COOKIE = "promora_refresh";
    private final AuthService auth;
    private final PromoraProperties props;

    public AuthController(AuthService auth, PromoraProperties props) {
        this.auth = auth;
        this.props = props;
    }

    private ResponseEntity<Map<String, Object>> respond(AuthService.Session s, HttpStatus status) {
        ResponseCookie cookie = ResponseCookie.from(COOKIE, s.refreshToken()).httpOnly(true).secure(props.cookiesSecure())
                .sameSite("Lax").path("/api/v1/auth").maxAge(Duration.ofDays(props.jwt().refreshDays())).build();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accessToken", s.accessToken());
        body.put("user", s.user());
        if (s.devVerificationToken() != null) body.put("devVerificationToken", s.devVerificationToken());
        return ResponseEntity.status(status).header(HttpHeaders.SET_COOKIE, cookie.toString()).body(body);
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest req, HttpServletRequest http) {
        return respond(auth.register(req, Util.clientIp(http)), HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@Valid @RequestBody LoginRequest req) {
        return respond(auth.login(req), HttpStatus.OK);
    }

    @PostMapping("/refresh")
    public ResponseEntity<Map<String, Object>> refresh(@CookieValue(name = COOKIE, required = false) String token) {
        return respond(auth.refresh(token), HttpStatus.OK);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@CookieValue(name = COOKIE, required = false) String token) {
        auth.logout(token);
        ResponseCookie clear = ResponseCookie.from(COOKIE, "").httpOnly(true).secure(props.cookiesSecure()).sameSite("Lax").path("/api/v1/auth").maxAge(0).build();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clear.toString()).build();
    }

    @PostMapping("/verify-email")
    public Map<String, Object> verify(@Valid @RequestBody TokenRequest req) {
        auth.verifyEmail(req.token());
        return Map.of("verified", true);
    }

    @PostMapping("/forgot-password")
    public Map<String, Object> forgot(@Valid @RequestBody EmailRequest req) {
        String devToken = auth.forgotPassword(req.email());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "If an account exists for this email, a reset link has been sent.");
        if (devToken != null) body.put("devResetToken", devToken);
        return body;
    }

    @PostMapping("/reset-password")
    public Map<String, Object> reset(@Valid @RequestBody ResetRequest req) {
        auth.resetPassword(req);
        return Map.of("reset", true);
    }
}
