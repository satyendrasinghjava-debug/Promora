package com.promora.user;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_profiles")
@Getter
@Setter
public class UserProfile {
    @Id
    @Column(name = "user_id")
    private UUID userId;
    private String phone;
    private String city;
    private String state;
    @Column(nullable = false) private String country = "IN";
    private String bio;
    @Column(name = "avatar_url") private String avatarUrl;
    @Column(name = "marketing_consent", nullable = false) private boolean marketingConsent;
    @Column(name = "terms_accepted_at") private Instant termsAcceptedAt;
    @Column(name = "profile_completed", nullable = false) private boolean profileCompleted;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt = Instant.now();
}
