package com.promora.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "subscriptions")
@Getter
@Setter
public class Subscription {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "plan_id", nullable = false) private UUID planId;
    @Column(nullable = false) private String status = "ACTIVE";
    @Column(name = "started_at", nullable = false) private Instant startedAt = Instant.now();
    @Column(name = "expires_at", nullable = false) private Instant expiresAt;
    @Column(name = "transaction_id") private UUID transactionId;
}
