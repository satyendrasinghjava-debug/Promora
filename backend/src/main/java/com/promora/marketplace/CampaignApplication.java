package com.promora.marketplace;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "campaign_applications")
@Getter
@Setter
public class CampaignApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "promoter_id", nullable = false) private UUID promoterId;
    @Column(name = "user_id", nullable = false) private UUID userId;
    private String pitch;
    @Column(nullable = false) private String status = "PENDING";
    @Column(name = "decision_note") private String decisionNote;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
