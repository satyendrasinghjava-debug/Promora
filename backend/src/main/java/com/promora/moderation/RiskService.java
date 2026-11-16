package com.promora.moderation;

import com.promora.common.Util;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class RiskService {
    private final RiskFlagRepository repo;

    public RiskService(RiskFlagRepository repo) { this.repo = repo; }

    /** Raises a risk flag once per dedupeKey. */
    public void flag(String type, UUID userId, String subjectType, String subjectId, String severity, String details, String dedupeKey) {
        if (dedupeKey != null && repo.existsByDedupeKey(dedupeKey)) return;
        RiskFlag f = new RiskFlag();
        f.setType(type);
        f.setUserId(userId);
        f.setSubjectType(subjectType);
        f.setSubjectId(subjectId);
        f.setSeverity(severity);
        f.setDetails(Util.truncate(details, 1000));
        f.setDedupeKey(dedupeKey);
        repo.save(f);
    }
}
