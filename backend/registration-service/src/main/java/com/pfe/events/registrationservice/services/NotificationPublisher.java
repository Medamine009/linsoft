package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.config.RabbitMQConfig;
import com.pfe.events.registrationservice.entities.Registration;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Publie des événements de notification sur RabbitMQ.
 * Format JSON consommé par notification-service.
 */
@Service
public class NotificationPublisher {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    @Autowired
    private UserEnrichmentService userEnrichment;

    @Autowired
    private EventEnrichmentService eventEnrichment;

    public void publishRegistrationConfirmed(String attendeeId, String eventId, String registrationId) {
        publishRegistrationEvent("REGISTRATION_CONFIRMED", attendeeId, eventId, registrationId);
    }

    public void publishRegistrationCancelled(String attendeeId, String eventId, String registrationId) {
        publishRegistrationEvent("REGISTRATION_CANCELLED", attendeeId, eventId, registrationId);
    }

    /** Le participant vient de soumettre une demande d'inscription (en attente de validation). */
    public void publishRegistrationRequested(String attendeeId, String eventId, String registrationId) {
        publishRegistrationEvent("REGISTRATION_REQUESTED", attendeeId, eventId, registrationId);
    }

    /** La demande d'inscription du participant a été refusée par un manager. */
    public void publishRegistrationRejected(String attendeeId, String eventId, String registrationId) {
        publishRegistrationEvent("REGISTRATION_REJECTED", attendeeId, eventId, registrationId);
    }

    /** Rappel automatique envoyé la veille de l'événement / formation. */
    public void publishReminder(String attendeeId, String eventId, String registrationId) {
        publishRegistrationEvent("EVENT_REMINDER", attendeeId, eventId, registrationId);
    }

    /** La session est terminée : le certificat entre en préparation. */
    public void publishEventCompleted(Registration reg) {
        publishForRegistration("EVENT_COMPLETED", reg);
    }

    /** L'administrateur a envoyé le certificat : il devient téléchargeable. */
    public void publishCertificateSent(Registration reg) {
        publishForRegistration("CERTIFICATE_SENT", reg);
    }

    /**
     * Publie à partir des seules données portées par l'inscription.
     *
     * <p>La clôture d'une session est annoncée par un planificateur : hors requête
     * HTTP, il n'y a aucun jeton à présenter au user-service, donc aucune manière
     * de résoudre l'adresse du participant à la volée. Elle est dénormalisée sur
     * l'inscription à cette fin ; l'appel distant ne sert plus que de rattrapage
     * pour les inscriptions antérieures.</p>
     */
    private void publishForRegistration(String type, Registration reg) {
        try {
            String email = reg.getAttendeeEmail();
            String firstName = reg.getAttendeeFirstName();
            if (email == null || email.isBlank()) {
                UserEnrichmentService.UserInfo u = userEnrichment.fetch(reg.getAttendeeId());
                if (u != null) { email = u.email; firstName = u.firstName; }
            }

            Map<String, String> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("email", email);
            payload.put("firstName", firstName);
            payload.put("eventTitle", reg.getEventTitle() != null ? reg.getEventTitle() : "Événement");
            payload.put("eventDate", reg.getEventDateStr() != null ? reg.getEventDateStr() : "—");
            payload.put("eventLocation", reg.getEventLocation() != null ? reg.getEventLocation() : "—");
            payload.put("registrationId", reg.getId());

            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, payload);
            System.out.println("[Publisher] Sent " + type + " for " + email);
        } catch (Exception ex) {
            System.err.println("[Publisher] Failed to publish " + type + " : " + ex.getMessage());
        }
    }

    private void publishRegistrationEvent(String type, String attendeeId, String eventId, String registrationId) {
        try {
            UserEnrichmentService.UserInfo u = userEnrichment.fetch(attendeeId);
            EventEnrichmentService.EventInfo e = eventEnrichment.fetch(eventId);

            Map<String, String> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("email", u != null ? u.email : null);
            payload.put("firstName", u != null ? u.firstName : null);
            payload.put("eventTitle", e != null ? e.title : "Événement");
            payload.put("eventDate", e != null && e.eventDate != null ? e.eventDate.toString() : "—");
            payload.put("eventLocation", e != null ? e.location : "—");
            payload.put("registrationId", registrationId);

            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, payload);
            System.out.println("[Publisher] Sent " + type + " for " + payload.get("email"));
        } catch (Exception ex) {
            System.err.println("[Publisher] Failed to publish " + type + " : " + ex.getMessage());
        }
    }
}
