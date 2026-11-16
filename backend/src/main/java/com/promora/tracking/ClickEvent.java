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
@Table(name = "click_events")
@Getter
@Setter
public class ClickEvent {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "tracking_link_id", nullable = false) private UUID trackingLinkId;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "promoter_user_id", nullable = false) private UUID promoterUserId;
    @Column(name = "visitor_hash", nullable = false) private String visitorHash;
    @Column(name = "ip_hash", nullable = false) private String ipHash;
    @Column(name = "user_agent") private String userAgent;
    private String referer;
    private String source;
    @Column(name = "click_day", nullable = false) private LocalDate clickDay;
    @Column(nullable = false) private boolean qualified;
    @Column(name = "reject_reason") private String rejectReason;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
