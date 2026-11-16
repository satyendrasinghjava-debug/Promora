package com.promora.payment;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository extends JpaRepository<Transaction, UUID> {
    Optional<Transaction> findByUserIdAndIdempotencyKey(UUID userId, String key);
    Optional<Transaction> findByProviderOrderId(String orderId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select t from Transaction t where t.id = :id") Optional<Transaction> lockById(@Param("id") UUID id);
}
