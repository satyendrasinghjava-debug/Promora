package com.promora.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String email;
    @Column(name = "password_hash", nullable = false) private String passwordHash;
    @Column(name = "full_name", nullable = false) private String fullName;
    @Column(nullable = false) private String status = "ACTIVE";
    @Column(name = "email_verified", nullable = false) private boolean emailVerified;
    @Column(name = "verified_badge", nullable = false) private boolean verifiedBadge;
    @Column(name = "promo_credits_paise", nullable = false) private long promoCreditsPaise;
    @Column(name = "token_version", nullable = false) private int tokenVersion;
    @Column(name = "signup_ip_hash") private String signupIpHash;
    @Column(name = "utm_source") private String utmSource;
    @Column(name = "utm_medium") private String utmMedium;
    @Column(name = "utm_campaign") private String utmCampaign;
    @Column(name = "last_login_at") private Instant lastLoginAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "user_roles", joinColumns = @JoinColumn(name = "user_id"))
    @Column(name = "role_name")
    private Set<String> roles = new HashSet<>();

    public boolean hasRole(String role) { return roles.contains(role); }
    public boolean isStaff() { return roles.contains("ADMIN") || roles.contains("SUPER_ADMIN"); }
}
