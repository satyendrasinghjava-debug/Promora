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
@Table(name = "risk_flags")
@Getter
@Setter
public class RiskFlag {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String type;
    @Column(name = "user_id") private UUID userId;
    @Column(name = "subject_type") private String subjectType;
    @Column(name = "subject_id") private String subjectId;
    @Column(nullable = false) private String severity = "MEDIUM";
    private String details;
    @Column(nullable = false) private String status = "OPEN";
    @Column(name = "resolution_note") private String resolutionNote;
    @Column(name = "resolved_by") private UUID resolvedBy;
    @Column(name = "resolved_at") private Instant resolvedAt;
    @Column(name = "dedupe_key") private String dedupeKey;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
