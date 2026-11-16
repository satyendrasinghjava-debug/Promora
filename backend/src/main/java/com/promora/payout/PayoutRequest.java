package com.promora.payout;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "payout_requests")
@Getter
@Setter
public class PayoutRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "promoter_user_id", nullable = false) private UUID promoterUserId;
    @Column(name = "amount_paise", nullable = false) private long amountPaise;
    @Column(name = "upi_id", nullable = false) private String upiId;
    @Column(nullable = false) private String status = "REQUESTED";
    @Column(name = "idempotency_key", nullable = false) private String idempotencyKey;
    @Column(name = "admin_note") private String adminNote;
    @Column(name = "paid_reference") private String paidReference;
    @Column(name = "decided_by") private UUID decidedBy;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
