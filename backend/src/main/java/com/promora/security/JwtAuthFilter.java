package com.promora.security;

import com.promora.user.User;
import com.promora.user.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwt;
    private final UserRepository users;
    private final JdbcTemplate jdbc;

    public JwtAuthFilter(JwtService jwt, UserRepository users, JdbcTemplate jdbc) {
        this.jwt = jwt;
        this.users = users;
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            JwtService.Parsed parsed = jwt.parse(header.substring(7));
            if (parsed != null) {
                User user = users.findById(parsed.userId()).orElse(null);
                // Suspended users and tokens issued before a password reset are rejected immediately.
                if (user != null && "ACTIVE".equals(user.getStatus()) && user.getTokenVersion() == parsed.tokenVersion()) {
                    Set<String> permissions = new HashSet<>();
                    if (user.isStaff()) {
                        String in = String.join(",", user.getRoles().stream().map(r -> "?").toList());
                        permissions.addAll(jdbc.queryForList("SELECT DISTINCT permission_name FROM role_permissions WHERE role_name IN (" + in + ")",
                                String.class, user.getRoles().toArray()));
                    }
                    List<GrantedAuthority> authorities = new ArrayList<>();
                    user.getRoles().forEach(r -> authorities.add(new SimpleGrantedAuthority("ROLE_" + r)));
                    permissions.forEach(p -> authorities.add(new SimpleGrantedAuthority(p)));
                    AuthUser principal = new AuthUser(user.getId(), user.getEmail(), Set.copyOf(user.getRoles()), permissions, user.isEmailVerified());
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(principal, null, authorities));
                }
            }
        }
        chain.doFilter(request, response);
    }
}
