package com.promora.tracking;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversionEventRepository extends JpaRepository<ConversionEvent, UUID> {
    boolean existsByCampaignIdAndDedupeKey(UUID campaignId, String dedupeKey);
}
