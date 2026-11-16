package com.promora.security;

import com.promora.config.PromoraProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class RateLimiterConfig {
    @Bean
    RateLimiter rateLimiter(PromoraProperties props, StringRedisTemplate redis) {
        if (props.redis() != null && props.redis().enabled()) {
            return (key, limit, windowSeconds) -> {
                String k = "rl:" + key + ":" + (System.currentTimeMillis() / 1000 / windowSeconds);
                Long n = redis.opsForValue().increment(k);
                if (n != null && n == 1) redis.expire(k, Duration.ofSeconds(windowSeconds + 1L));
                return n == null || n <= limit;
            };
        }
        // Single-instance fallback. Use Redis (REDIS_ENABLED=true) when running more than one instance.
        ConcurrentHashMap<String, int[]> counters = new ConcurrentHashMap<>();
        return (key, limit, windowSeconds) -> {
            long window = System.currentTimeMillis() / 1000 / windowSeconds;
            if (counters.size() > 100_000) counters.clear();
            int[] slot = counters.compute(key, (k, v) -> v == null || v[0] != (int) window ? new int[]{(int) window, 1} : new int[]{v[0], v[1] + 1});
            return slot[1] <= limit;
        };
    }
}
