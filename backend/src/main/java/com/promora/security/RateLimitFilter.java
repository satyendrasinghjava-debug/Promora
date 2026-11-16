package com.promora.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.promora.common.GlobalExceptionHandler;
import com.promora.common.Util;
import com.promora.config.PromoraProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class RateLimitFilter extends OncePerRequestFilter {
    private final RateLimiter limiter;
    private final boolean enabled;
    private final ObjectMapper mapper;

    public RateLimitFilter(RateLimiter limiter, PromoraProperties props, ObjectMapper mapper) {
        this.limiter = limiter;
        this.enabled = props.ratelimit() == null || props.ratelimit().enabled();
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        if (enabled) {
            String path = request.getRequestURI();
            String ip = Util.clientIp(request);
            int limit = 0;
            String bucket = null;
            if (path.equals("/api/v1/auth/refresh") || path.equals("/api/v1/auth/logout")) { limit = 120; bucket = "session"; }
            else if (path.startsWith("/api/v1/auth/")) { limit = 20; bucket = "auth"; }
            else if (path.startsWith("/r/")) { limit = 60; bucket = "redirect"; }
            else if (path.startsWith("/api/v1/public/") && !"GET".equals(request.getMethod())) { limit = 20; bucket = "public-write"; }
            else if (path.startsWith("/api/v1/public/")) { limit = 240; bucket = "public-read"; }
            else if (path.startsWith("/api/v1/")) { limit = 600; bucket = "api"; }
            if (bucket != null && !limiter.allow(bucket + ":" + ip, limit, 60)) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setHeader("Retry-After", "60");
                response.setContentType("application/json");
                mapper.writeValue(response.getWriter(), GlobalExceptionHandler.body(HttpStatus.TOO_MANY_REQUESTS, "RATE_LIMITED",
                        "Too many requests. Please wait a minute and try again.", null));
                return;
            }
        }
        chain.doFilter(request, response);
    }
}
