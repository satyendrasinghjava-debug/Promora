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
@Table(name = "conversion_events")
@Getter
@Setter
public class ConversionEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "tracking_link_id", nullable = false) private UUID trackingLinkId;
    @Column(name = "promoter_user_id", nullable = false) private UUID promoterUserId;
    @Column(name = "click_event_id") private UUID clickEventId;
    @Column(nullable = false) private String type;
    @Column(name = "dedupe_key", nullable = false) private String dedupeKey;
    @Column(nullable = false) private String status = "VERIFIED";
    @Column(name = "lead_name") private String leadName;
    @Column(name = "lead_email") private String leadEmail;
    @Column(name = "lead_phone") private String leadPhone;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
