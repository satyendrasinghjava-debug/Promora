package com.promora.commission;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "commissions")
@Getter
@Setter
public class Commission {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "conversion_event_id", nullable = false) private UUID conversionEventId;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(name = "promoter_user_id", nullable = false) private UUID promoterUserId;
    @Column(name = "amount_paise", nullable = false) private long amountPaise;
    @Column(name = "platform_fee_paise", nullable = false) private long platformFeePaise;
    @Column(nullable = false) private String status = "PENDING";
    @Column(name = "hold_until", nullable = false) private Instant holdUntil;
    @Column(name = "payout_request_id") private UUID payoutRequestId;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
