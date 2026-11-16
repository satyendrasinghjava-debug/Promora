package com.promora.security;

import java.util.Set;
import java.util.UUID;

/** Authenticated principal, rebuilt from the database on every request. */
public record AuthUser(UUID id, String email, Set<String> roles, Set<String> permissions, boolean emailVerified) {
    public boolean hasRole(String role) { return roles.contains(role); }
    public boolean isStaff() { return roles.contains("ADMIN") || roles.contains("SUPER_ADMIN"); }
}
