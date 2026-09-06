package com.pfe.events.registrationservice.controllers;

import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.services.CertificateService;
import com.pfe.events.registrationservice.services.ParticipationProgressService;
import com.pfe.events.registrationservice.services.RegistrationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/registrations")
public class RegistrationController {

    @Autowired
    private RegistrationService registrationService;

    @Autowired
    private CertificateService certificateService;

    @Autowired
    private ParticipationProgressService progressService;

    @PostMapping("/event/{eventId}/attendee/{attendeeId}")
    public ResponseEntity<Registration> registerForEvent(
            @PathVariable String eventId,
            @PathVariable String attendeeId,
            @RequestParam(required = false) String ticketType,
            @RequestParam(required = false) Double ticketPrice) {
        try {
            Registration registration = registrationService.registerForEvent(eventId, attendeeId, ticketType, ticketPrice);
            return new ResponseEntity<>(registration, HttpStatus.CREATED);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build(); // ou une erreur plus descriptive
        }
    }

    @GetMapping
    public ResponseEntity<List<Registration>> getAll() {
        return ResponseEntity.ok(registrationService.getAllRegistrations());
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<Registration>> getRegistrationsByEvent(@PathVariable String eventId) {
        return ResponseEntity.ok(registrationService.getRegistrationsByEventId(eventId));
    }

    @GetMapping("/attendee/{attendeeId}")
    public ResponseEntity<List<Registration>> getRegistrationsByAttendee(@PathVariable String attendeeId) {
        return ResponseEntity.ok(registrationService.getRegistrationsByAttendeeId(attendeeId));
    }

    /**
     * GET /attendee/{id}/tracking — inscriptions du participant enrichies de son
     * avancement : les jalons du parcours, la fin de session calculée et l'état
     * de son certificat. Sert le suivi affiché dans « Mes inscriptions ».
     */
    @GetMapping("/attendee/{attendeeId}/tracking")
    public ResponseEntity<List<Map<String, Object>>> getAttendeeTracking(@PathVariable String attendeeId) {
        List<Map<String, Object>> out = registrationService.getRegistrationsByAttendeeId(attendeeId)
                .stream().map(this::withTracking).toList();
        return ResponseEntity.ok(out);
    }

    /** L'inscription telle quelle, augmentée de son parcours et de sa fin de session. */
    private Map<String, Object> withTracking(Registration reg) {
        Map<String, Object> dto = new java.util.LinkedHashMap<>();
        dto.put("id", reg.getId());
        dto.put("eventId", reg.getEventId());
        dto.put("attendeeId", reg.getAttendeeId());
        dto.put("attendeeName", reg.getAttendeeName());
        dto.put("registrationDate", reg.getRegistrationDate());
        dto.put("status", reg.getStatus());
        dto.put("checkedIn", reg.isCheckedIn());
        dto.put("checkedInAt", reg.getCheckedInAt());
        dto.put("ticketType", reg.getTicketType());
        dto.put("eventTitle", reg.getEventTitle());
        dto.put("eventLocation", reg.getEventLocation());
        dto.put("eventDateStr", reg.getEventDateStr());
        dto.put("eventDurationStr", reg.getEventDurationStr());
        dto.put("progressStatus", reg.getProgressStatus());
        dto.put("progressPercent", reg.getProgressPercent());
        dto.put("completedAt", reg.getCompletedAt());
        dto.put("certificateStatus", reg.getCertificateStatus());
        dto.put("certificateSentAt", reg.getCertificateSentAt());
        dto.put("certificateDownloadable", registrationService.isCertificateDownloadable(reg));

        java.time.LocalDateTime end = progressService.end(reg);
        dto.put("eventEndDateStr", end != null ? end.toString() : null);

        dto.put("steps", progressService.steps(reg).stream().map(s -> {
            Map<String, Object> step = new java.util.LinkedHashMap<>();
            step.put("key", s.key);
            step.put("label", s.label);
            step.put("done", s.done);
            step.put("missed", s.missed);
            return step;
        }).toList());
        return dto;
    }

    /**
     * GET /event/{eventId}/emails — adresses des inscrits encore concernés par la
     * session (annulés et refusés exclus). Sert à event-service pour prévenir les
     * participants d'une modification ou d'une annulation de session.
     */
    @GetMapping("/event/{eventId}/emails")
    public ResponseEntity<List<String>> getAttendeeEmails(@PathVariable String eventId) {
        return ResponseEntity.ok(registrationService.getActiveAttendeeEmails(eventId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Registration> getRegistrationById(@PathVariable String id) {
        return registrationService.getRegistrationById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /** GET /api/registrations/{id}/verify — PUBLIC (pas d'auth). Pour la page de vérification scannée. */
    @GetMapping("/{id}/verify")
    public ResponseEntity<Map<String, Object>> verify(@PathVariable String id) {
        return registrationService.getRegistrationById(id).map(r -> {
            Map<String, Object> dto = new java.util.HashMap<>();
            dto.put("id", r.getId());
            dto.put("eventId", r.getEventId());
            dto.put("attendeeId", r.getAttendeeId());
            dto.put("status", r.getStatus());
            dto.put("registrationDate", r.getRegistrationDate());
            dto.put("eventTitle", r.getEventTitle() != null ? r.getEventTitle() : "Événement");
            dto.put("eventLocation", r.getEventLocation());
            dto.put("eventDateStr", r.getEventDateStr());
            dto.put("attendeeName", r.getAttendeeName());
            dto.put("valid", "CONFIRMED".equals(r.getStatus()));
            dto.put("checkedIn", r.isCheckedIn());
            dto.put("checkedInAt", r.getCheckedInAt());
            dto.put("ticketType", r.getTicketType());
            dto.put("ticketPrice", r.getTicketPrice());
            return ResponseEntity.ok(dto);
        }).orElseGet(() -> {
            Map<String, Object> err = new java.util.HashMap<>();
            err.put("valid", false);
            err.put("error", "Billet introuvable");
            return ResponseEntity.status(404).body(err);
        });
    }

    /** PUT /api/registrations/{id}/checkin — valide le billet à l'entrée (organisateur/admin). */
    @PutMapping("/{id}/checkin")
    public ResponseEntity<Map<String, Object>> checkIn(@PathVariable String id) {
        try {
            RegistrationService.CheckInResult res = registrationService.checkIn(id);
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("result", res.result); // OK | ALREADY | INVALID
            body.put("checkedIn", res.registration.isCheckedIn());
            body.put("checkedInAt", res.registration.getCheckedInAt());
            body.put("attendeeName", res.registration.getAttendeeName());
            body.put("eventTitle", res.registration.getEventTitle());
            body.put("eventId", res.registration.getEventId());
            body.put("status", res.registration.getStatus());
            return ResponseEntity.ok(body);
        } catch (RuntimeException e) {
            Map<String, Object> err = new java.util.HashMap<>();
            err.put("result", "NOT_FOUND");
            return ResponseEntity.status(404).body(err);
        }
    }

    /** PUT /api/registrations/{id}/checkin/undo — annule un check-in. */
    @PutMapping("/{id}/checkin/undo")
    public ResponseEntity<Registration> undoCheckIn(@PathVariable String id) {
        try {
            return ResponseEntity.ok(registrationService.undoCheckIn(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<Registration> cancelRegistration(@PathVariable String id) {
        try {
            Registration cancelled = registrationService.cancelRegistration(id);
            return ResponseEntity.ok(cancelled);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** POST /api/registrations/admin/resync — recalcule availableSeats pour tous les events
     *  (utile pour les données pre-existantes créées avant l'ajout du décrémenteur). */
    @PostMapping("/admin/resync-seats")
    public ResponseEntity<String> resyncSeats() {
        registrationService.resyncAllEventSeats();
        return ResponseEntity.ok("Resync started");
    }

    // ═══════════════ Certificat de participation (PDF) ═══════════════

    /**
     * GET /api/registrations/{id}/certificate — certificat PDF.
     *
     * <p>Le participant ne peut le télécharger qu'une fois l'administrateur l'a
     * envoyé, et uniquement le sien. L'administration (admin / formateur) y accède
     * sans restriction : elle en a besoin pour contrôler avant l'envoi.</p>
     */
    @GetMapping("/{id}/certificate")
    public ResponseEntity<byte[]> certificate(@PathVariable String id, Authentication auth) {
        return registrationService.getRegistrationById(id).map(reg -> {
            if (!"CONFIRMED".equals(reg.getStatus())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).<byte[]>build();
            }
            if (!isStaff(auth)) {
                if (!callerId(auth).equals(String.valueOf(reg.getAttendeeId()))) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN).<byte[]>build();
                }
                if (!registrationService.isCertificateDownloadable(reg)) {
                    // Préparé mais pas encore envoyé par l'administrateur.
                    return ResponseEntity.status(HttpStatus.CONFLICT).<byte[]>build();
                }
            }
            byte[] pdf = certificateService.generate(reg);
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_PDF);
            h.setContentDisposition(ContentDisposition.inline()
                    // Même référence que celle imprimée sur le document.
                    .filename("certificat-" + CertificateService.shortRef(id) + ".pdf").build());
            return new ResponseEntity<>(pdf, h, HttpStatus.OK);
        }).orElse(ResponseEntity.notFound().build());
    }

    /** GET /certificates/pending — file des certificats à traiter (admin). */
    @GetMapping("/certificates/pending")
    public ResponseEntity<List<Registration>> pendingCertificates() {
        return ResponseEntity.ok(registrationService.getPendingCertificates());
    }

    /** PUT /{id}/certificate/send — l'admin envoie le certificat au participant. */
    @PutMapping("/{id}/certificate/send")
    public ResponseEntity<?> sendCertificate(@PathVariable String id, Authentication auth) {
        try {
            return ResponseEntity.ok(registrationService.sendCertificate(id, callerName(auth)));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** PUT /{id}/certificate/hold — l'admin diffère l'envoi (à traiter plus tard). */
    @PutMapping("/{id}/certificate/hold")
    public ResponseEntity<?> holdCertificate(@PathVariable String id, Authentication auth) {
        try {
            return ResponseEntity.ok(registrationService.holdCertificate(id, callerName(auth)));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /** POST /certificates/event/{eventId}/send-all — envoi groupé pour une session terminée. */
    @PostMapping("/certificates/event/{eventId}/send-all")
    public ResponseEntity<Map<String, Object>> sendAllCertificates(@PathVariable String eventId, Authentication auth) {
        int sent = registrationService.sendCertificatesForEvent(eventId, callerName(auth));
        return ResponseEntity.ok(Map.of("eventId", eventId, "sent", sent));
    }

    // ─── Identité de l'appelant (jeton Keycloak) ───

    /** Admin ou formateur : accès à l'ensemble des certificats. */
    private boolean isStaff(Authentication auth) {
        if (auth == null) return false;
        for (GrantedAuthority a : auth.getAuthorities()) {
            String role = a.getAuthority();
            if ("ROLE_ADMIN".equals(role) || "ROLE_ORGANISATEUR".equals(role)) return true;
        }
        return false;
    }

    /** Identifiant Keycloak (sub) de l'appelant — sert au contrôle de propriété. */
    private String callerId(Authentication auth) {
        if (auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jt) {
            return String.valueOf(jt.getToken().getSubject());
        }
        return "";
    }

    /** Nom lisible de l'administrateur ayant tranché (trace sur l'inscription). */
    private String callerName(Authentication auth) {
        if (auth instanceof org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken jt) {
            String name = jt.getToken().getClaimAsString("name");
            if (name == null || name.isBlank()) name = jt.getToken().getClaimAsString("preferred_username");
            if (name != null && !name.isBlank()) return name;
        }
        return auth != null ? auth.getName() : "—";
    }

    // ═══════════════ Validation par le manager ═══════════════

    /** POST /event/{eventId}/attendee/{attendeeId}/request — demande soumise à validation manager. */
    @PostMapping("/event/{eventId}/attendee/{attendeeId}/request")
    public ResponseEntity<Registration> requestApproval(
            @PathVariable String eventId, @PathVariable String attendeeId,
            @RequestParam(required = false) String ticketType,
            @RequestParam(required = false) Double ticketPrice) {
        try {
            return new ResponseEntity<>(
                    registrationService.requestApproval(eventId, attendeeId, ticketType, ticketPrice),
                    HttpStatus.CREATED);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    /** GET /api/registrations/pending — file d'attente de validation (manager/admin). */
    @GetMapping("/pending")
    public ResponseEntity<List<Registration>> pending() {
        return ResponseEntity.ok(registrationService.getPending());
    }

    @PutMapping("/{id}/approve")
    public ResponseEntity<Registration> approve(@PathVariable String id) {
        try { return ResponseEntity.ok(registrationService.approve(id)); }
        catch (RuntimeException e) { return ResponseEntity.badRequest().build(); }
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<Registration> reject(@PathVariable String id) {
        try { return ResponseEntity.ok(registrationService.reject(id)); }
        catch (RuntimeException e) { return ResponseEntity.notFound().build(); }
    }

    // ═══════════════ Analytics ═══════════════

    /** GET /api/registrations/stats — KPIs globaux (présence, no-show…). */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(registrationService.globalStats());
    }

    /** GET /api/registrations/stats/attendee/{id} — historique de formation d'un collaborateur. */
    @GetMapping("/stats/attendee/{attendeeId}")
    public ResponseEntity<Map<String, Object>> attendeeStats(@PathVariable String attendeeId) {
        return ResponseEntity.ok(registrationService.attendeeStats(attendeeId));
    }
}
