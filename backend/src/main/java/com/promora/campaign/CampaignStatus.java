package com.promora.campaign;

import com.promora.common.ApiException;

import java.util.Map;
import java.util.Set;

/** The campaign state machine. Every status change in the system goes through {@link #require}. */
public final class CampaignStatus {
    private CampaignStatus() {}

    public static final String DRAFT = "DRAFT", PENDING_REVIEW = "PENDING_REVIEW", CHANGES_REQUESTED = "CHANGES_REQUESTED",
            APPROVED = "APPROVED", ACTIVE = "ACTIVE", PAUSED = "PAUSED", COMPLETED = "COMPLETED", CANCELLED = "CANCELLED",
            REJECTED = "REJECTED", TERMINATED = "TERMINATED";

    private static final Map<String, Set<String>> ALLOWED = Map.of(
            DRAFT, Set.of(PENDING_REVIEW, CANCELLED),
            CHANGES_REQUESTED, Set.of(PENDING_REVIEW, CANCELLED),
            PENDING_REVIEW, Set.of(APPROVED, REJECTED, CHANGES_REQUESTED, CANCELLED),
            APPROVED, Set.of(ACTIVE, CANCELLED, TERMINATED),
            ACTIVE, Set.of(PAUSED, COMPLETED, CANCELLED, TERMINATED),
            PAUSED, Set.of(ACTIVE, COMPLETED, CANCELLED, TERMINATED),
            COMPLETED, Set.of(), CANCELLED, Set.of(), REJECTED, Set.of(), TERMINATED, Set.of());

    public static boolean canTransition(String from, String to) { return ALLOWED.getOrDefault(from, Set.of()).contains(to); }

    public static void require(String from, String to) {
        if (!canTransition(from, to))
            throw ApiException.conflict("INVALID_TRANSITION", "A campaign that is " + label(from) + " cannot become " + label(to));
    }

    public static boolean editable(String status) { return DRAFT.equals(status) || CHANGES_REQUESTED.equals(status); }

    public static String label(String s) { return s.toLowerCase().replace('_', ' '); }
}
