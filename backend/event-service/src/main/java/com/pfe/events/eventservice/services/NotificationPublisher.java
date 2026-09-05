package com.pfe.events.eventservice.services;

import com.pfe.events.eventservice.config.RabbitMQConfig;
import com.pfe.events.eventservice.entities.Event;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * Publie une notification sur RabbitMQ à la création d'une session.
 * Format JSON consommé par notification-service.
 */
@Service
public class NotificationPublisher {

    @Autowired
    private RabbitTemplate rabbitTemplate;

    /** Notifie l'organisateur/formateur que sa session a bien été soumise à modération. */
    public void publishEventSubmitted(Event e) {
        publish(e, "EVENT_SUBMITTED");
    }

    /**
     * Notifie l'organisateur/formateur que sa session est publiée d'emblée.
     * Cas d'une création par un administrateur : elle ne passe pas par la modération.
     */
    public void publishEventPublished(Event e) {
        publish(e, "EVENT_PUBLISHED");
    }

    private void publish(Event e, String type) {
        if (e == null || e.getOrganizerEmail() == null || e.getOrganizerEmail().isBlank()) {
            System.out.println("[Publisher] Pas d'email organisateur, notification ignorée");
            return;
        }
        try {
            Map<String, String> payload = new HashMap<>();
            payload.put("type", type);
            payload.put("email", e.getOrganizerEmail());
            payload.put("firstName", e.getOrganizerName());
            payload.put("eventTitle", e.getTitle() != null ? e.getTitle() : "Session");
            payload.put("eventDate", e.getEventDate() != null ? e.getEventDate().toString() : "—");
            payload.put("eventLocation", e.getLocation() != null ? e.getLocation() : "—");
            payload.put("registrationId", e.getId());

            rabbitTemplate.convertAndSend(RabbitMQConfig.EXCHANGE_NAME, RabbitMQConfig.ROUTING_KEY, payload);
            System.out.println("[Publisher] Sent " + type + " for " + payload.get("email"));
        } catch (Exception ex) {
            System.err.println("[Publisher] Failed to publish " + type + " : " + ex.getMessage());
        }
    }
}
