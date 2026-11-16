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
@Table(name = "moderation_actions")
@Getter
@Setter
public class ModerationAction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "admin_user_id", nullable = false) private UUID adminUserId;
    @Column(name = "target_type", nullable = false) private String targetType;
    @Column(name = "target_id", nullable = false) private UUID targetId;
    @Column(nullable = false) private String action;
    private String reason;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
