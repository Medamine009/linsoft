package com.pfe.events.notificationservice.services;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${app.mail.from:noreply@eventify.local}")
    private String from;

    public boolean sendSimpleMessage(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(from);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
            System.out.println("[Email] sent (plain) to " + to);
            return true;
        } catch (Exception e) {
            System.err.println("[Email] failed to " + to + " : " + e.getMessage());
            return false;
        }
    }

    /**
     * Envoie un email HTML. Ne propage JAMAIS d'exception : l'échec d'un
     * destinataire (adresse invalide, SMTP injoignable…) ne doit pas faire
     * échouer toute une diffusion. Renvoie {@code true} si l'email est parti.
     *
     * <p>Attention : {@code JavaMailSender.send} lève une {@code MailException}
     * (RuntimeException), pas une {@code MessagingException} — d'où le catch large.</p>
     */
    public boolean sendHtml(String to, String subject, String html) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html, true);
            mailSender.send(message);
            System.out.println("[Email] sent (html) to " + to + " — " + subject);
            return true;
        } catch (MessagingException | RuntimeException e) {
            System.err.println("[Email] failed to " + to + " : " + e.getMessage());
            return false;
        }
    }
}
