package com.promora.payout;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PayoutRequestRepository extends JpaRepository<PayoutRequest, UUID> {
    Optional<PayoutRequest> findByPromoterUserIdAndIdempotencyKey(UUID promoterUserId, String key);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select p from PayoutRequest p where p.id = :id") Optional<PayoutRequest> lockById(@Param("id") UUID id);
}
