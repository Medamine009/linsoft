package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.repositories.RegistrationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Clôture automatique des sessions terminées.
 *
 * <p>Toutes les dix minutes, on repasse sur les inscriptions confirmées : celles
 * dont la session vient de se terminer basculent en « terminée », leur certificat
 * entre en préparation, et le participant reçoit un email — une seule fois, d'où
 * le drapeau {@code completionNotified}.</p>
 *
 * <p>Le calcul lui-même vit dans {@link ParticipationProgressService} : la page
 * participant le rejoue à l'affichage, le planificateur ne sert qu'à prévenir
 * les gens qui ne sont pas devant leur écran et à alimenter la file de
 * l'administrateur.</p>
 */
@Component
public class EventCompletionScheduler {

    @Autowired
    private RegistrationRepository registrationRepository;

    @Autowired
    private ParticipationProgressService progress;

    @Autowired
    private NotificationPublisher notificationPublisher;

    @Scheduled(initialDelay = 90_000, fixedRate = 600_000) // 1 min 30 après le démarrage, puis toutes les 10 min
    public void closeFinishedSessions() {
        int completed = 0;

        for (Registration reg : registrationRepository.findAll()) {
            // Inscription antérieure au suivi : sa durée de session est inconnue et,
            // hors requête HTTP, on n'a aucun jeton pour aller la chercher. La
            // première consultation authentifiée la complètera ; la clôturer ici
            // sur une durée par défaut risquerait de le faire trop tôt.
            if (reg.getProgressStatus() == null) continue;

            boolean changed = progress.refresh(reg);
            boolean justCompleted = "COMPLETED".equals(reg.getProgressStatus())
                    && "CONFIRMED".equalsIgnoreCase(String.valueOf(reg.getStatus()))
                    && !reg.isCompletionNotified();

            if (justCompleted) {
                try {
                    notificationPublisher.publishEventCompleted(reg);
                } catch (Exception e) {
                    System.err.println("[Clôture] notification impossible pour " + reg.getId() + " : " + e.getMessage());
                }
                // Marqué même si la publication a échoué : mieux vaut un email
                // manquant qu'un rappel à chaque passage du planificateur.
                reg.setCompletionNotified(true);
                changed = true;
                completed++;
            }

            if (changed) registrationRepository.save(reg);
        }

        if (completed > 0) {
            System.out.println("[Clôture] " + completed + " session(s) terminée(s) — certificats en préparation.");
        }
    }
}
