package com.pfe.events.eventservice.controllers;

import com.pfe.events.eventservice.entities.Event;
import com.pfe.events.eventservice.services.EventChangeService;
import com.pfe.events.eventservice.services.EventService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
public class EventController {

    @Autowired
    private EventService eventService;

    @Autowired
    private EventChangeService changeService;

    /**
     * POST /api/events — création d'une session.
     * L'admin étant l'autorité de modération, ce qu'il crée est publié directement ;
     * une session créée par un organisateur reste en attente de validation.
     */
    @PostMapping
    public ResponseEntity<Event> createEvent(@RequestBody Event event, Authentication authentication) {
        Event created = eventService.createEvent(event, isAdmin(authentication));
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    /** Rôle porté par le jeton (converti en ROLE_… par JwtAuthConverter). */
    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    }

    @GetMapping
    public ResponseEntity<List<Event>> getAllEvents() {
        return ResponseEntity.ok(eventService.getAllEvents());
    }

    /** GET /api/events/stats — statistiques du catalogue (tableau de bord). */
    @GetMapping("/stats")
    public ResponseEntity<java.util.Map<String, Object>> stats() {
        return ResponseEntity.ok(eventService.stats());
    }

    /** GET /api/events/published — uniquement les événements approuvés (vue participant). */
    @GetMapping("/published")
    public ResponseEntity<List<Event>> getPublishedEvents() {
        return ResponseEntity.ok(eventService.getPublishedEvents());
    }

    /** GET /api/events/status/PENDING — liste par statut de modération (vue admin). */
    @GetMapping("/status/{status}")
    public ResponseEntity<List<Event>> getEventsByStatus(@PathVariable String status) {
        return ResponseEntity.ok(eventService.getEventsByStatus(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Event> getEventById(@PathVariable String id) {
        return eventService.getEventById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** GET /api/events/{id}/public — détail public d'un événement (page billet scannée). */
    @GetMapping("/{id}/public")
    public ResponseEntity<Event> getEventPublic(@PathVariable String id) {
        return eventService.getEventById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<List<Event>> getEventsByCategory(@PathVariable String category) {
        return ResponseEntity.ok(eventService.getEventsByCategory(category));
    }

    @GetMapping("/organizer/{organizerId}")
    public ResponseEntity<List<Event>> getEventsByOrganizer(@PathVariable String organizerId) {
        return ResponseEntity.ok(eventService.getEventsByOrganizer(organizerId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Event> updateEvent(@PathVariable String id, @RequestBody Event event) {
        try {
            Event updated = eventService.updateEvent(id, event);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable String id) {
        eventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    /** PUT /api/events/{id}/status?status=APPROVED — modération (admin uniquement). */
    @PutMapping("/{id}/status")
    public ResponseEntity<Event> updateStatus(@PathVariable String id, @RequestParam String status) {
        try {
            Event updated = eventService.updateStatus(id, status);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ═══════════ Demandes de l'organisateur sur une session publiée ═══════════

    /**
     * PUT /api/events/{id}/request-update — l'organisateur propose une modification.
     * La session au catalogue ne bouge pas tant que l'admin n'a pas approuvé.
     */
    @PutMapping("/{id}/request-update")
    public ResponseEntity<?> requestUpdate(@PathVariable String id,
                                           @RequestBody Event.PendingChange proposed,
                                           Authentication authentication) {
        return handleChange(() -> changeService.requestUpdate(id, proposed, requesterId(authentication)));
    }

    /** PUT /api/events/{id}/request-cancel — demande d'annulation motivée. */
    @PutMapping("/{id}/request-cancel")
    public ResponseEntity<?> requestCancel(@PathVariable String id,
                                           @RequestBody CancelRequest body,
                                           Authentication authentication) {
        return handleChange(() -> changeService.requestCancel(
                id, body == null ? null : body.reason, requesterId(authentication)));
    }

    /** PUT /api/events/{id}/withdraw-change — l'organisateur retire sa demande. */
    @PutMapping("/{id}/withdraw-change")
    public ResponseEntity<?> withdrawChange(@PathVariable String id, Authentication authentication) {
        return handleChange(() -> changeService.withdraw(id, requesterId(authentication)));
    }

    /**
     * PUT /api/events/{id}/ack-decision — l'organisateur prend acte de l'issue.
     * Volontairement hors du préfixe /change/, réservé à l'administrateur.
     */
    @PutMapping("/{id}/ack-decision")
    public ResponseEntity<?> acknowledgeDecision(@PathVariable String id, Authentication authentication) {
        return handleChange(() -> changeService.acknowledgeDecision(id, requesterId(authentication)));
    }

    /** GET /api/events/changes/pending — file des demandes à trancher (admin). */
    @GetMapping("/changes/pending")
    public ResponseEntity<List<Event>> pendingChanges() {
        return ResponseEntity.ok(changeService.pendingChanges());
    }

    /** PUT /api/events/{id}/change/approve — applique la demande et prévient les inscrits. */
    @PutMapping("/{id}/change/approve")
    public ResponseEntity<?> approveChange(@PathVariable String id) {
        return handleChange(() -> changeService.approve(id));
    }

    /** PUT /api/events/{id}/change/reject — refuse la demande, la session reste en l'état. */
    @PutMapping("/{id}/change/reject")
    public ResponseEntity<?> rejectChange(@PathVariable String id) {
        return handleChange(() -> changeService.reject(id));
    }

    /**
     * Traduit les refus métier en réponses lisibles par l'interface : un motif
     * manquant ou une demande déjà en cours doivent s'afficher tels quels, pas
     * en « erreur serveur ».
     */
    private ResponseEntity<?> handleChange(java.util.function.Supplier<Event> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (SecurityException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", e.getMessage()));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Un admin agit sans restriction de propriété ; un organisateur, sur ses seules
     * sessions. L'identité comparée est le {@code sub} du jeton : c'est lui que le
     * front enregistre dans {@code organizerId} à la création, pas le nom d'utilisateur.
     */
    private String requesterId(Authentication authentication) {
        if (authentication == null || isAdmin(authentication)) return null;
        if (authentication instanceof JwtAuthenticationToken jt) return jt.getToken().getSubject();
        return authentication.getName();
    }

    /** Corps de la demande d'annulation. */
    public static class CancelRequest {
        public String reason;
    }

    /** PUT /api/events/{id}/seats?delta=-1 — ajustement atomique pour inscription/annulation. */
    @PutMapping("/{id}/seats")
    public ResponseEntity<Event> adjustSeats(@PathVariable String id, @RequestParam int delta) {
        try {
            Event updated = eventService.adjustAvailableSeats(id, delta);
            return ResponseEntity.ok(updated);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
