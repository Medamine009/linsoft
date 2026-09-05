package com.pfe.events.notificationservice.listeners;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pfe.events.notificationservice.config.RabbitMQConfig;
import com.pfe.events.notificationservice.dto.NotificationEvent;
import com.pfe.events.notificationservice.entities.InAppMessage;
import com.pfe.events.notificationservice.repositories.InAppMessageRepository;
import com.pfe.events.notificationservice.services.EmailService;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class NotificationListener {

    @Autowired
    private EmailService emailService;

    @Autowired
    private InAppMessageRepository messageRepository;

    private final ObjectMapper mapper = new ObjectMapper();

    @RabbitListener(queues = RabbitMQConfig.QUEUE_NAME)
    public void handle(String payload) {
        System.out.println("[Notification] Received: " + payload);
        try {
            NotificationEvent evt = mapper.readValue(payload, NotificationEvent.class);
            if (evt.getEmail() == null || evt.getEmail().isBlank()) {
                System.err.println("[Notification] No email in payload, skipping");
                return;
            }
            String subject = subjectFor(evt);
            // 1) Email (MailHog en dev)
            emailService.sendHtml(evt.getEmail(), subject, htmlFor(evt));
            // 2) Notification IN-APP : visible dans la boîte de réception du destinataire
            try {
                messageRepository.save(new InAppMessage(evt.getEmail(), subject, plainFor(evt), "SYSTEM"));
            } catch (Exception ignored) {}
        } catch (Exception e) {
            System.err.println("[Notification] Failed to process: " + e.getMessage());
        }
    }

    /** Message court en texte brut pour la notification in-app. */
    private String plainFor(NotificationEvent e) {
        String t = safe(e.getEventTitle());
        switch (String.valueOf(e.getType())) {
            case "REGISTRATION_CONFIRMED": return "Votre inscription à « " + t + " » est confirmée. Votre billet est disponible dans « Mes inscriptions ».";
            case "REGISTRATION_REQUESTED": return "Votre demande d'inscription à « " + t + " » a été enregistrée. Elle est en attente de validation.";
            case "REGISTRATION_REJECTED": return "Votre demande d'inscription à « " + t + " » n'a pas été retenue cette fois-ci.";
            case "REGISTRATION_CANCELLED": return "Votre inscription à « " + t + " » a été annulée.";
            case "EVENT_PUBLISHED": return "Une nouvelle session est disponible : « " + t + " ».";
            case "EVENT_REMINDER": return "Rappel : « " + t + " » a lieu prochainement (" + safe(e.getEventDate()) + ").";
            case "EVENT_COMPLETED": return "La session « " + t + " » est terminée. Votre certificat de participation est en cours de préparation.";
            case "CERTIFICATE_SENT": return "Votre certificat de participation à « " + t + " » est disponible dans « Mes inscriptions ».";
            default: return "Vous avez une nouvelle notification concernant « " + t + " ».";
        }
    }

    private String subjectFor(NotificationEvent e) {
        switch (String.valueOf(e.getType())) {
            case "REGISTRATION_CONFIRMED": return "Inscription confirmée — " + safe(e.getEventTitle());
            case "REGISTRATION_REQUESTED": return "Demande reçue — " + safe(e.getEventTitle());
            case "REGISTRATION_REJECTED": return "Demande non retenue — " + safe(e.getEventTitle());
            case "REGISTRATION_CANCELLED": return "Inscription annulée — " + safe(e.getEventTitle());
            case "EVENT_SUBMITTED": return "Session enregistrée — " + safe(e.getEventTitle());
            case "EVENT_PUBLISHED": return "Nouvelle session disponible — " + safe(e.getEventTitle());
            case "EVENT_REMINDER": return "Rappel — " + safe(e.getEventTitle());
            case "EVENT_COMPLETED": return "Session terminée — " + safe(e.getEventTitle());
            case "CERTIFICATE_SENT": return "Votre certificat est disponible — " + safe(e.getEventTitle());
            default: return "Notification LINSOFT Learning Center";
        }
    }

    private String htmlFor(NotificationEvent e) {
        String greet = (e.getFirstName() == null || e.getFirstName().isBlank()) ? "Bonjour" : "Bonjour " + e.getFirstName();
        String title;
        String body;
        String accent;

        switch (String.valueOf(e.getType())) {
            case "REGISTRATION_CONFIRMED":
                title = "Votre participation est confirmée";
                accent = "#10b981";
                body = "Votre inscription pour <strong>" + safe(e.getEventTitle()) + "</strong> est confirmée.<br>"
                    + "Date : " + safe(e.getEventDate()) + "<br>"
                    + "Lieu : " + safe(e.getEventLocation()) + "<br><br>"
                    + "Votre billet est disponible dans « Mes inscriptions » sur LINSOFT Learning Center.";
                break;
            case "REGISTRATION_REQUESTED":
                title = "Demande d'inscription enregistrée";
                accent = "#d97706";
                body = "Votre demande d'inscription pour <strong>" + safe(e.getEventTitle()) + "</strong> a bien été reçue.<br>"
                    + "Date : " + safe(e.getEventDate()) + "<br>"
                    + "Lieu : " + safe(e.getEventLocation()) + "<br><br>"
                    + "Elle est <strong>en attente de validation</strong> par un administrateur. "
                    + "Vous recevrez un email dès qu'elle sera confirmée.";
                break;
            case "REGISTRATION_REJECTED":
                title = "Demande non retenue";
                accent = "#ef4444";
                body = "Votre demande d'inscription pour <strong>" + safe(e.getEventTitle()) + "</strong> n'a pas été retenue cette fois-ci.<br><br>"
                    + "N'hésitez pas à explorer les autres sessions du catalogue ou à contacter votre responsable formation.";
                break;
            case "REGISTRATION_CANCELLED":
                title = "Inscription annulée";
                accent = "#ef4444";
                body = "Votre inscription pour <strong>" + safe(e.getEventTitle()) + "</strong> a été annulée. "
                    + "Vous pouvez vous réinscrire à tout moment si des places sont encore disponibles.";
                break;
            case "EVENT_SUBMITTED":
                title = "Votre session a été enregistrée";
                accent = "#e2231a";
                body = "Votre session <strong>" + safe(e.getEventTitle()) + "</strong> a bien été enregistrée.<br>"
                    + "Date : " + safe(e.getEventDate()) + "<br>"
                    + "Lieu : " + safe(e.getEventLocation()) + "<br><br>"
                    + "Elle sera visible dans le catalogue après validation par un administrateur.";
                break;
            case "EVENT_PUBLISHED":
                title = "Nouvelle session disponible";
                accent = "#e2231a";
                body = "Une nouvelle session vient d'être publiée : <strong>" + safe(e.getEventTitle()) + "</strong>.<br>"
                    + "Date : " + safe(e.getEventDate()) + " — Lieu : " + safe(e.getEventLocation()) + "<br><br>"
                    + "Inscrivez-vous sur LINSOFT Learning Center.";
                break;
            case "EVENT_COMPLETED":
                title = "Session terminée";
                accent = "#6366f1";
                body = "La session <strong>" + safe(e.getEventTitle()) + "</strong> est terminée. Merci de votre participation.<br><br>"
                    + "Votre <strong>certificat de participation est en cours de préparation</strong>. "
                    + "Il vous sera transmis dès sa validation par l'administrateur — vous pouvez suivre son état "
                    + "dans « Mes inscriptions » sur LINSOFT Learning Center.";
                break;
            case "CERTIFICATE_SENT":
                title = "Votre certificat est disponible";
                accent = "#10b981";
                body = "Votre certificat de participation pour <strong>" + safe(e.getEventTitle()) + "</strong> a été validé et vous est délivré.<br><br>"
                    + "Retrouvez-le au format PDF dans « Mes inscriptions » sur LINSOFT Learning Center.";
                break;
            default:
                title = "Notification";
                accent = "#e2231a";
                body = "Vous avez une nouvelle notification sur LINSOFT Learning Center.";
        }

        return template(greet, title, body, accent);
    }

    private String template(String greet, String title, String body, String accent) {
        return "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
            + "<body style='font-family:Inter,Arial,sans-serif;background:#fafafa;padding:40px 20px;margin:0;color:#0a0a0a;'>"
            + "<div style='max-width:560px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);'>"
            + "<div style='background:linear-gradient(135deg," + accent + ",#c41d14);padding:32px 30px;color:white;'>"
            + "<div style='font-size:18px;font-weight:700;letter-spacing:-0.3px;margin-bottom:4px;'>LINSOFT Learning Center</div>"
            + "<h1 style='margin:8px 0 0;font-size:24px;font-weight:700;letter-spacing:-0.5px;'>" + title + "</h1>"
            + "</div>"
            + "<div style='padding:32px 30px;'>"
            + "<p style='margin:0 0 16px;font-size:15px;color:#525252;'>" + greet + ",</p>"
            + "<p style='margin:0 0 24px;font-size:15px;line-height:1.7;color:#0a0a0a;'>" + body + "</p>"
            + "<a href='http://localhost:4200' style='display:inline-block;background:#e2231a;color:white;padding:11px 22px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;'>Ouvrir la plateforme</a>"
            + "</div>"
            + "<div style='padding:18px 30px;background:#f7f7f8;border-top:1px solid #ececef;font-size:12px;color:#8e8e93;'>"
            + "Email automatique — ne pas répondre. © 2026 LINSOFT Learning Center"
            + "</div></div></body></html>";
    }

    private String safe(String s) { return s == null ? "—" : s; }
}
