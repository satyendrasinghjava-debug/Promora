package com.promora.referral;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "referral_rewards")
@Getter
@Setter
public class ReferralReward {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "referral_id", nullable = false) private UUID referralId;
    @Column(name = "beneficiary_user_id", nullable = false) private UUID beneficiaryUserId;
    @Column(name = "amount_paise", nullable = false) private long amountPaise;
    @Column(name = "reward_type", nullable = false) private String rewardType = "PROMO_CREDIT";
    @Column(nullable = false) private String status = "PENDING_APPROVAL";
    private String note;
    @Column(name = "decided_by") private UUID decidedBy;
    @Column(name = "decided_at") private Instant decidedAt;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
