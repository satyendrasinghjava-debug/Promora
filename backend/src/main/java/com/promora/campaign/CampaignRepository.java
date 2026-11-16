package com.promora.campaign;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CampaignRepository extends JpaRepository<Campaign, UUID> {
    boolean existsBySlug(String slug);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Campaign c where c.id = :id") Optional<Campaign> lockById(@Param("id") UUID id);
    long countByOwnerUserIdAndStatusIn(UUID ownerUserId, List<String> statuses);
}
