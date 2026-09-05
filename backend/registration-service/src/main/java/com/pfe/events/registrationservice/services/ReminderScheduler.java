package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.repositories.RegistrationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Envoi automatique des rappels avant une session.
 * Toutes les 30 minutes, on cherche les inscriptions confirmées dont l'événement
 * a lieu dans les prochaines 24 h et qui n'ont pas encore reçu de rappel, puis on
 * publie un message EVENT_REMINDER (consommé par notification-service → email).
 */
@Component
public class ReminderScheduler {

    @Autowired
    private RegistrationRepository registrationRepository;

    @Autowired
    private NotificationPublisher notificationPublisher;

    /** Fenêtre de rappel : 24 h avant la session. */
    private static final long WINDOW_HOURS = 24;

    @Scheduled(initialDelay = 60_000, fixedRate = 1_800_000) // démarre après 1 min, puis toutes les 30 min
    public void sendUpcomingReminders() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime windowEnd = now.plusHours(WINDOW_HOURS);
        int sent = 0;

        for (Registration reg : registrationRepository.findAll()) {
            if (reg.isReminderSent()) continue;
            if (!"CONFIRMED".equals(reg.getStatus())) continue;

            LocalDateTime eventDate = parseDate(reg.getEventDateStr());
            if (eventDate == null) continue;

            // L'événement a lieu entre maintenant et dans 24 h
            if (eventDate.isAfter(now) && eventDate.isBefore(windowEnd)) {
                try {
                    notificationPublisher.publishReminder(reg.getAttendeeId(), reg.getEventId(), reg.getId());
                    reg.setReminderSent(true);
                    registrationRepository.save(reg);
                    sent++;
                } catch (Exception e) {
                    System.err.println("[Reminder] échec pour " + reg.getId() + " : " + e.getMessage());
                }
            }
        }
        if (sent > 0) {
            System.out.println("[Reminder] " + sent + " rappel(s) envoyé(s).");
        }
    }

    private LocalDateTime parseDate(String s) {
        if (s == null || s.isBlank()) return null;
        try {
            return LocalDateTime.parse(s);
        } catch (Exception ignored) {
            return null;
        }
    }
}
