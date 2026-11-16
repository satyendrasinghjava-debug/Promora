package com.promora.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);
    private final NotificationRepository repo;
    private final EmailSender email;
    private final JdbcTemplate jdbc;

    public NotificationService(NotificationRepository repo, EmailSender email, JdbcTemplate jdbc) {
        this.repo = repo;
        this.email = email;
        this.jdbc = jdbc;
    }

    public void notify(UUID userId, String type, String title, String body, String link) {
        Notification n = new Notification();
        n.setUserId(userId);
        n.setType(type);
        n.setTitle(title);
        n.setBody(body);
        n.setLink(link);
        repo.save(n);
    }

    /** Alerts every staff account that holds the given permission. */
    public void notifyStaff(String permission, String type, String title, String body, String link) {
        List<UUID> staff = jdbc.queryForList("""
                SELECT DISTINCT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_name = ur.role_name
                WHERE rp.permission_name = ?""", UUID.class, permission);
        staff.forEach(id -> notify(id, type, title, body, link));
    }

    public void email(String to, String subject, String body) {
        try {
            email.send(to, subject, body);
        } catch (Exception e) {
            log.warn("Email to {} failed: {}", to, e.getMessage());
        }
        jdbc.update("INSERT INTO email_log (to_email, subject, body, transport) VALUES (?,?,?,?)", to, subject, body, email.transport());
    }
}
