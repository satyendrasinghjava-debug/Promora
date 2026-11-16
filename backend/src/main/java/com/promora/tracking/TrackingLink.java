package com.promora.tracking;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "tracking_links")
@Getter
@Setter
public class TrackingLink {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "application_id", nullable = false) private UUID applicationId;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "promoter_user_id", nullable = false) private UUID promoterUserId;
    @Column(nullable = false) private String code;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
