package com.promora.commission;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CommissionRepository extends JpaRepository<Commission, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select c from Commission c where c.promoterUserId = :uid and c.status = :status and c.payoutRequestId is null") List<Commission> lockAvailable(@Param("uid") UUID uid, @Param("status") String status);
    List<Commission> findByPayoutRequestId(UUID payoutRequestId);
    List<Commission> findByStatusAndHoldUntilBefore(String status, Instant before);
}
