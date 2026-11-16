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
@Table(name = "user_reports")
@Getter
@Setter
public class UserReport {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "reporter_user_id") private UUID reporterUserId;
    @Column(name = "reporter_email") private String reporterEmail;
    @Column(name = "target_type", nullable = false) private String targetType;
    @Column(name = "target_id", nullable = false) private UUID targetId;
    @Column(nullable = false) private String reason;
    private String details;
    @Column(nullable = false) private String status = "OPEN";
    private String resolution;
    @Column(name = "resolved_by") private UUID resolvedBy;
    @Column(name = "resolved_at") private Instant resolvedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
