package com.promora.security;

/** Fixed-window counter. Returns true when the call is allowed. */
public interface RateLimiter {
    boolean allow(String key, int limit, int windowSeconds);
}
