package com.promora.promoter;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "promoter_profiles")
@Getter
@Setter
public class PromoterProfile {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(name = "user_id", nullable = false) private UUID userId;
    @Column(name = "display_name", nullable = false) private String displayName;
    @Column(nullable = false) private String slug;
    private String bio;
    @Column(name = "audience_size", nullable = false) private int audienceSize;
    @Column(name = "audience_description") private String audienceDescription;
    private String interests;
    private String languages;
    @Column(name = "instagram_url") private String instagramUrl;
    @Column(name = "youtube_url") private String youtubeUrl;
    @Column(name = "linkedin_url") private String linkedinUrl;
    @Column(name = "website_url") private String websiteUrl;
    @Column(name = "upi_id") private String upiId;
    @Column(name = "verification_status", nullable = false) private String verificationStatus = "NONE";
    @Column(nullable = false) private boolean hidden;
    @Column(name = "created_at", nullable = false) private Instant createdAt = Instant.now();
}
