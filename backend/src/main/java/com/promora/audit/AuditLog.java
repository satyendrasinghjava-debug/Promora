package com.promora.audit;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "actor_user_id") private UUID actorUserId;
    @Column(name = "actor_email") private String actorEmail;
    @Column(nullable = false) private String action;
    @Column(name = "target_type") private String targetType;
    @Column(name = "target_id") private String targetId;
    private String details;
    private String ip;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
