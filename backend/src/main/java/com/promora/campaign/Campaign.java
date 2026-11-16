package com.promora.campaign;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "campaigns")
@Getter
@Setter
public class Campaign {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "advertiser_id", nullable = false) private UUID advertiserId;
    @Column(name = "owner_user_id", nullable = false) private UUID ownerUserId;
    @Column(nullable = false) private String title;
    @Column(nullable = false) private String slug;
    @Column(nullable = false) private String description;
    @Column(name = "category_id") private UUID categoryId;
    @Column(nullable = false) private String objective = "WEBSITE_VISITS";
    @Column(name = "target_audience") private String targetAudience;
    @Column(nullable = false) private String geography = "India";
    @Column(name = "landing_url") private String landingUrl;
    @Column(name = "reward_type", nullable = false) private String rewardType = "CPC";
    @Column(name = "reward_paise", nullable = false) private long rewardPaise;
    @Column(name = "budget_paise", nullable = false) private long budgetPaise;
    @Column(name = "funded_paise", nullable = false) private long fundedPaise;
    @Column(name = "spent_paise", nullable = false) private long spentPaise;
    @Column(nullable = false) private String currency = "INR";
    @Column(name = "start_date") private LocalDate startDate;
    @Column(name = "end_date") private LocalDate endDate;
    @Column(name = "application_mode", nullable = false) private String applicationMode = "APPROVAL";
    @Column(name = "promo_instructions") private String promoInstructions;
    @Column(name = "disclosure_text") private String disclosureText;
    @Column(nullable = false) private String status = "DRAFT";
    @Column(name = "review_note") private String reviewNote;
    @Column(nullable = false) private boolean featured;
    @Column(name = "submitted_at") private Instant submittedAt;
    @Column(name = "approved_at") private Instant approvedAt;
    @Version private long version;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
}
