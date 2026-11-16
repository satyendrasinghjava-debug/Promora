package com.promora.payment;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "transactions")
@Getter
@Setter
public class Transaction {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "campaign_id") private UUID campaignId;
    @Column(nullable = false) private String type;
    @Column(name = "amount_paise", nullable = false) private long amountPaise;
    @Column(name = "base_paise", nullable = false) private long basePaise;
    @Column(name = "credit_paise", nullable = false) private long creditPaise;
    @Column(name = "fee_paise", nullable = false) private long feePaise;
    @Column(name = "tax_paise", nullable = false) private long taxPaise;
    @Column(nullable = false) private String currency = "INR";
    @Column(nullable = false) private String status = "CREATED";
    @Column(nullable = false) private String provider;
    @Column(name = "provider_order_id") private String providerOrderId;
    @Column(name = "provider_payment_id") private String providerPaymentId;
    @Column(name = "idempotency_key", nullable = false) private String idempotencyKey;
    @Column(name = "reference_id") private UUID referenceId;
    private String description;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
}
