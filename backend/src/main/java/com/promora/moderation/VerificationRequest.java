package com.promora.moderation;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "verification_requests")
@Getter
@Setter
public class VerificationRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "profile_type", nullable = false) private String profileType;
    private String note;
    @Column(name = "document_url") private String documentUrl;
    @Column(nullable = false) private String status = "PENDING";
    @Column(name = "decision_reason") private String decisionReason;
    @Column(name = "decided_by") private UUID decidedBy;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
