package com.promora.advertiser;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "advertiser_profiles")
@Getter
@Setter
public class AdvertiserProfile {
	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	private UUID id;
	@Column(name = "user_id", nullable = false)
	private UUID userId;
	@Column(name = "business_name", nullable = false)
	private String businessName;
	@Column(nullable = false)
	private String slug;
	@Column(name = "category_id")
	private UUID categoryId;
	private String website;
	private String description;
	@Column(name = "logo_url")
	private String logoUrl;
	private String city;
	@Column(name = "verification_status", nullable = false)
	private String verificationStatus = "NONE";
	@Column(nullable = false)
	private boolean hidden;
	@Column(name = "created_at", nullable = false)
	private Instant createdAt = Instant.now();
}
