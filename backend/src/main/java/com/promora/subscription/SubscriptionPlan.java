package com.promora.subscription;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "subscription_plans")
@Getter
@Setter
public class SubscriptionPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false) private String code;
    @Column(nullable = false) private String name;
    @Column(name = "price_paise", nullable = false) private long pricePaise;
    @Column(nullable = false) private String period = "MONTHLY";
    @Column(name = "max_active_campaigns", nullable = false) private int maxActiveCampaigns;
    @Column(name = "platform_fee_bps", nullable = false) private int platformFeeBps;
    @Column(nullable = false) private String features = "";
    @Column(nullable = false) private boolean highlighted;
    @Column(nullable = false) private boolean active = true;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
}
