package com.promora.security;

import com.promora.config.PromoraProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

@Service
public class JwtService {
    private final SecretKey key;
    private final int accessMinutes;

    public JwtService(PromoraProperties props) {
        String secret = props.jwt().secret();
        if (secret == null || secret.getBytes(StandardCharsets.UTF_8).length < 32)
            throw new IllegalStateException("JWT_SECRET must be set to at least 32 bytes");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.accessMinutes = props.jwt().accessMinutes();
    }

    public String issue(UUID userId, int tokenVersion) {
        Instant now = Instant.now();
        return Jwts.builder().subject(userId.toString()).claim("tv", tokenVersion)
                .issuedAt(Date.from(now)).expiration(Date.from(now.plus(accessMinutes, ChronoUnit.MINUTES)))
                .signWith(key).compact();
    }

    public record Parsed(UUID userId, int tokenVersion) {}

    /** Returns null when the token is missing, malformed, expired or signed with another key. */
    public Parsed parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return new Parsed(UUID.fromString(c.getSubject()), c.get("tv", Integer.class));
        } catch (Exception e) {
            return null;
        }
    }
}
