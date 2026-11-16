package com.promora.audit;

import com.promora.common.Util;
import com.promora.security.AuthUser;
import org.springframework.stereotype.Service;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.UUID;

@Service
public class AuditService {
    private final AuditLogRepository repo;

    public AuditService(AuditLogRepository repo) { this.repo = repo; }

    /** Joins the caller's transaction, so the audit row commits or rolls back with the change it describes. */
    public void log(AuthUser actor, String action, String targetType, Object targetId, String details) {
        log(actor == null ? null : actor.id(), actor == null ? null : actor.email(), action, targetType, targetId, details);
    }

    public void log(UUID actorId, String actorEmail, String action, String targetType, Object targetId, String details) {
        AuditLog a = new AuditLog();
        a.setActorUserId(actorId);
        a.setActorEmail(actorEmail);
        a.setAction(action);
        a.setTargetType(targetType);
        a.setTargetId(targetId == null ? null : targetId.toString());
        a.setDetails(Util.truncate(details, 2000));
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs) a.setIp(Util.clientIp(attrs.getRequest()));
        repo.save(a);
    }
}
