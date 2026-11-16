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
@Table(name = "campaign_assets")
@Getter
@Setter
public class CampaignAsset {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "campaign_id", nullable = false) private UUID campaignId;
    @Column(nullable = false) private String url;
    @Column(nullable = false) private String kind = "IMAGE";
    @Column(name = "alt_text") private String altText;
    @Column(name = "sort_order", nullable = false) private int sortOrder;
}
