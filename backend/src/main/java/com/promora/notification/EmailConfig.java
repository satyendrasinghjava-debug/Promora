package com.promora.notification;

import com.promora.config.PromoraProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

@Configuration
public class EmailConfig {
    private static final Logger log = LoggerFactory.getLogger(EmailConfig.class);

    @Bean
    EmailSender emailSender(ObjectProvider<JavaMailSender> mailSender, PromoraProperties props,
                            @org.springframework.beans.factory.annotation.Value("${spring.mail.host:}") String mailHost) {
        // SMTP is used only when MAIL_HOST is actually set; an empty value means "no mail server".
        JavaMailSender smtp = mailHost == null || mailHost.isBlank() ? null : mailSender.getIfAvailable();
        if (smtp != null) {
            return new EmailSender() {
                public void send(String to, String subject, String body) {
                    SimpleMailMessage m = new SimpleMailMessage();
                    m.setFrom(props.mail().from());
                    m.setTo(to);
                    m.setSubject(subject);
                    m.setText(body);
                    smtp.send(m);
                }
                public String transport() { return "smtp"; }
            };
        }
        // No SMTP configured: messages are written to the application log and the email_log table only.
        return new EmailSender() {
            public void send(String to, String subject, String body) { log.info("[email not sent: no MAIL_HOST] to={} subject={}\n{}", to, subject, body); }
            public String transport() { return "log"; }
        };
    }
}
