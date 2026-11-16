package com.promora.referral;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "referrals")
@Getter
@Setter
public class Referral {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "referrer_user_id", nullable = false) private UUID referrerUserId;
    @Column(name = "referred_user_id", nullable = false) private UUID referredUserId;
    @Column(nullable = false) private String code;
    @Column(name = "referred_type") private String referredType;
    @Column(nullable = false) private String status = "PENDING";
    @Column(nullable = false) private boolean suspicious;
    @Column(name = "suspicious_reason") private String suspiciousReason;
    @Column(name = "activated_at") private Instant activatedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
