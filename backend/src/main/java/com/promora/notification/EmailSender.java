package com.promora.notification;

/** Email transport abstraction. Implementations: SMTP (when MAIL_HOST is set) and a local log transport. */
public interface EmailSender {
    void send(String to, String subject, String body);
    String transport();
}
