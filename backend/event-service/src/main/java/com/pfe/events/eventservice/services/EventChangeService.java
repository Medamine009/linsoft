package com.pfe.events.eventservice.services;

import com.pfe.events.eventservice.entities.Event;
import com.pfe.events.eventservice.entities.Event.PendingChange;
import com.pfe.events.eventservice.repositories.EventRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Cycle de vie des demandes de l'organisateur sur une session déjà publiée.
 *
 * <p>Un organisateur ne modifie ni n'annule directement une session au catalogue :
 * des collaborateurs y sont déjà inscrits. Il dépose une demande, l'administrateur
 * tranche, et c'est seulement à l'approbation que la session change — et que les
 * participants sont prévenus.</p>
 */
@Service
public class EventChangeService {

    private static final DateTimeFormatter FR =
            DateTimeFormatter.ofPattern("dd/MM/yyyy 'à' HH'h'mm");

    private final EventRepository eventRepository;
    private final ParticipantNotifier participantNotifier;

    public EventChangeService(EventRepository eventRepository, ParticipantNotifier participantNotifier) {
        this.eventRepository = eventRepository;
        this.participantNotifier = participantNotifier;
    }

    // ─────────────────────── Demandes de l'organisateur ───────────────────────

    /**
     * Dépose une demande de modification. L'événement publié n'est pas touché :
     * les valeurs proposées attendent dans {@code pendingChange}.
     */
    public Event requestUpdate(String id, PendingChange proposed, String requesterId) {
        Event event = load(id);
        assertOwner(event, requesterId);
        assertNoPendingChange(event);
        if (isCancelled(event)) throw new IllegalStateException("Cette session est annulée.");

        proposed.setType("UPDATE");
        proposed.setRequestedBy(requesterId);
        proposed.setRequestedAt(LocalDateTime.now());
        if (proposed.getRequestedByName() == null) proposed.setRequestedByName(event.getOrganizerName());
        event.setPendingChange(proposed);
        event.setUpdatedAt(LocalDateTime.now());
        return eventRepository.save(event);
    }

    /** Dépose une demande d'annulation motivée. Le motif est obligatoire. */
    public Event requestCancel(String id, String reason, String requesterId) {
        Event event = load(id);
        assertOwner(event, requesterId);
        assertNoPendingChange(event);
        if (isCancelled(event)) throw new IllegalStateException("Cette session est déjà annulée.");
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Le motif d'annulation est obligatoire.");
        }

        PendingChange change = new PendingChange();
        change.setType("CANCEL");
        change.setReason(reason.trim());
        change.setRequestedBy(requesterId);
        change.setRequestedByName(event.getOrganizerName());
        change.setRequestedAt(LocalDateTime.now());
        event.setPendingChange(change);
        event.setUpdatedAt(LocalDateTime.now());
        return eventRepository.save(event);
    }

    /** L'organisateur retire sa propre demande tant qu'elle n'est pas tranchée. */
    public Event withdraw(String id, String requesterId) {
        Event event = load(id);
        assertOwner(event, requesterId);
        event.setPendingChange(null);
        event.setUpdatedAt(LocalDateTime.now());
        return eventRepository.save(event);
    }

    // ─────────────────────── Décision de l'administrateur ───────────────────────

    /** Sessions portant une demande en attente (file de modération). */
    public List<Event> pendingChanges() {
        return eventRepository.findAll().stream()
                .filter(e -> e.getPendingChange() != null)
                .collect(Collectors.toList());
    }

    /**
     * Approuve la demande : la modification est appliquée, ou la session passe en
     * CANCELLED. Les participants sont ensuite prévenus par email et in-app.
     */
    public Event approve(String id) {
        Event event = load(id);
        PendingChange change = event.getPendingChange();
        if (change == null) throw new IllegalStateException("Aucune demande en attente sur cette session.");

        String subject;
        String message;

        if ("CANCEL".equalsIgnoreCase(change.getType())) {
            event.setStatus("CANCELLED");
            event.setCancelReason(change.getReason());
            subject = "Session annulée — " + safe(event.getTitle());
            message = "La session « " + safe(event.getTitle()) + " » prévue le "
                    + when(event.getEventDate()) + " est annulée.\n\n"
                    + "Motif communiqué par l'organisateur : " + safe(change.getReason()) + "\n\n"
                    + "Votre inscription n'est plus valable. Vous pouvez consulter le catalogue "
                    + "pour trouver une autre session.";
        } else {
            List<String> changes = apply(event, change);
            subject = "Session modifiée — " + safe(event.getTitle());
            message = "La session « " + safe(event.getTitle()) + " » à laquelle vous êtes inscrit(e) a été mise à jour.\n\n"
                    + (changes.isEmpty()
                        ? "Les informations de la session ont été actualisées."
                        : String.join("\n", changes))
                    + (change.getReason() != null && !change.getReason().isBlank()
                        ? "\n\nPrécision de l'organisateur : " + safe(change.getReason())
                        : "")
                    + "\n\nRetrouvez le détail à jour dans « Mes inscriptions ».";
        }

        event.setPendingChange(null);
        event.setLastChangeDecision(decision(change, "APPROVED"));
        event.setUpdatedAt(LocalDateTime.now());
        Event saved = eventRepository.save(event);

        // La notification ne doit jamais faire échouer la décision déjà enregistrée.
        try {
            participantNotifier.notifyParticipants(saved.getId(), subject, message);
        } catch (Exception e) {
            System.err.println("[Change] notification participants échouée pour " + id + " : " + e.getMessage());
        }
        return saved;
    }

    /**
     * Refuse la demande : la session reste en l'état et les participants ne sont
     * pas dérangés. L'issue est conservée pour que l'organisateur sache que sa
     * demande a bien été examinée, puis écartée.
     */
    public Event reject(String id) {
        Event event = load(id);
        PendingChange change = event.getPendingChange();
        if (change == null) {
            throw new IllegalStateException("Aucune demande en attente sur cette session.");
        }
        event.setPendingChange(null);
        event.setLastChangeDecision(decision(change, "REJECTED"));
        event.setUpdatedAt(LocalDateTime.now());
        return eventRepository.save(event);
    }

    /** L'organisateur a vu l'issue : on efface l'avis pour libérer son fil. */
    public Event acknowledgeDecision(String id, String requesterId) {
        Event event = load(id);
        assertOwner(event, requesterId);
        event.setLastChangeDecision(null);
        return eventRepository.save(event);
    }

    private Event.ChangeDecision decision(PendingChange change, String outcome) {
        Event.ChangeDecision d = new Event.ChangeDecision();
        d.setType(change.getType());
        d.setOutcome(outcome);
        d.setReason(change.getReason());
        d.setDecidedAt(LocalDateTime.now());
        return d;
    }

    // ─────────────────────── Interne ───────────────────────

    /**
     * Reporte les valeurs proposées sur l'événement et décrit en français ce qui
     * change, pour que le message aux participants dise précisément quoi.
     * Un champ null signifie « inchangé » : l'organisateur n'a pas à tout renvoyer.
     */
    private List<String> apply(Event event, PendingChange c) {
        List<String> lines = new ArrayList<>();

        if (changed(c.getTitle(), event.getTitle())) {
            lines.add("• Intitulé : « " + safe(event.getTitle()) + " » devient « " + safe(c.getTitle()) + " »");
            event.setTitle(c.getTitle());
        }
        if (c.getEventDate() != null && !c.getEventDate().equals(event.getEventDate())) {
            lines.add("• Date : " + when(event.getEventDate()) + " → " + when(c.getEventDate()));
            event.setEventDate(c.getEventDate());
        }
        if (changed(c.getLocation(), event.getLocation())) {
            lines.add("• Lieu : " + safe(event.getLocation()) + " → " + safe(c.getLocation()));
            event.setLocation(c.getLocation());
        }
        if (changed(c.getMode(), event.getMode())) {
            lines.add("• Format : " + modeLabel(event.getMode()) + " → " + modeLabel(c.getMode()));
            event.setMode(c.getMode());
        }
        if (changed(c.getVisioLink(), event.getVisioLink())) {
            lines.add("• Le lien de visioconférence a été mis à jour.");
            event.setVisioLink(c.getVisioLink());
        }
        if (changed(c.getDescription(), event.getDescription())) {
            lines.add("• Le descriptif de la session a été mis à jour.");
            event.setDescription(c.getDescription());
        }
        if (changed(c.getCategory(), event.getCategory())) {
            lines.add("• Catégorie : " + safe(event.getCategory()) + " → " + safe(c.getCategory()));
            event.setCategory(c.getCategory());
        }
        if (c.getTotalSeats() != null && !c.getTotalSeats().equals(event.getTotalSeats())) {
            // Les places déjà réservées sont préservées : on ne déplace que le solde disponible.
            int reserved = reservedSeats(event);
            lines.add("• Nombre de places : " + event.getTotalSeats() + " → " + c.getTotalSeats());
            event.setTotalSeats(c.getTotalSeats());
            event.setAvailableSeats(Math.max(0, c.getTotalSeats() - reserved));
        }
        // Champs de contenu : mis à jour sans détailler, ils n'affectent pas la logistique
        if (changed(c.getLevel(), event.getLevel())) event.setLevel(c.getLevel());
        if (changed(c.getDuration(), event.getDuration())) event.setDuration(c.getDuration());
        if (changed(c.getPrerequisites(), event.getPrerequisites())) event.setPrerequisites(c.getPrerequisites());
        if (changed(c.getSpeaker(), event.getSpeaker())) event.setSpeaker(c.getSpeaker());
        if (changed(c.getCertification(), event.getCertification())) event.setCertification(c.getCertification());
        if (c.getLatitude() != null) event.setLatitude(c.getLatitude());
        if (c.getLongitude() != null) event.setLongitude(c.getLongitude());

        return lines;
    }

    /** Places déjà réservées, déduites de l'écart total / disponible. */
    private int reservedSeats(Event e) {
        int total = e.getTotalSeats() == null ? 0 : e.getTotalSeats();
        int avail = e.getAvailableSeats() == null ? total : e.getAvailableSeats();
        return Math.max(0, total - avail);
    }

    private boolean changed(String proposed, String current) {
        return proposed != null && !proposed.equals(current);
    }

    private boolean isCancelled(Event e) { return "CANCELLED".equalsIgnoreCase(e.getStatus()); }

    private Event load(String id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found with id " + id));
    }

    /** Un organisateur n'agit que sur ses propres sessions. */
    private void assertOwner(Event event, String requesterId) {
        if (requesterId == null) return;                      // admin : pas de restriction
        if (!requesterId.equals(event.getOrganizerId())) {
            throw new SecurityException("Cette session ne vous appartient pas.");
        }
    }

    private void assertNoPendingChange(Event event) {
        if (event.getPendingChange() != null) {
            throw new IllegalStateException("Une demande est déjà en attente de validation sur cette session.");
        }
    }

    private String when(LocalDateTime d) { return d == null ? "date à confirmer" : d.format(FR); }

    private String modeLabel(String mode) {
        if (mode == null) return "—";
        return switch (mode.toUpperCase()) {
            case "EN_LIGNE" -> "En ligne";
            case "HYBRIDE" -> "Hybride";
            default -> "Présentiel";
        };
    }

    private String safe(String s) { return s == null || s.isBlank() ? "—" : s; }
}
