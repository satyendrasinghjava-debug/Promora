package com.promora.security;

import com.promora.common.ApiException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

public final class Current {
    private Current() {}

    public static AuthUser user() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !(a.getPrincipal() instanceof AuthUser u))
            throw new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in");
        return u;
    }

    public static AuthUser userOrNull() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getPrincipal() instanceof AuthUser u ? u : null;
    }

    public static void requireVerifiedEmail() {
        if (!user().emailVerified())
            throw new ApiException(org.springframework.http.HttpStatus.FORBIDDEN, "EMAIL_NOT_VERIFIED", "Verify your email address to continue");
    }
}
