package com.promora.marketplace;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignApplicationRepository extends JpaRepository<CampaignApplication, UUID> {
    Optional<CampaignApplication> findByCampaignIdAndUserId(UUID campaignId, UUID userId);
    long countByUserIdAndStatus(UUID userId, String status);
}
