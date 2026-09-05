package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.repositories.RegistrationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class RegistrationService {

    @Autowired
    private RegistrationRepository registrationRepository;

    @Autowired
    private NotificationPublisher notificationPublisher;

    @Autowired
    private EventSeatUpdater seatUpdater;

    @Autowired
    private UserEnrichmentService userEnrichment;

    @Autowired
    private EventEnrichmentService eventEnrichment;

    @Autowired
    private ParticipationProgressService progress;

    /** Statuts d'un certificat encore à traiter par l'administrateur. */
    private static final List<String> CERT_TODO = List.of("IN_PREPARATION", "PENDING_APPROVAL");

    public Registration registerForEvent(String eventId, String attendeeId) {
        return registerForEvent(eventId, attendeeId, null, null);
    }

    public Registration registerForEvent(String eventId, String attendeeId, String ticketType, Double ticketPrice) {
        if (registrationRepository.existsByEventIdAndAttendeeIdAndStatus(eventId, attendeeId, "CONFIRMED")) {
            throw new RuntimeException("User is already registered for this event.");
        }

        Registration registration = new Registration();
        registration.setEventId(eventId);
        registration.setAttendeeId(attendeeId);
        registration.setStatus("CONFIRMED");
        registration.setTicketType(ticketType);
        registration.setTicketPrice(ticketPrice);

        String ticketSeed = UUID.randomUUID().toString() + "-" + eventId + "-" + attendeeId;
        registration.setQrCodeTicket("QR-" + ticketSeed);

        // Dénormalisation : on stocke les infos event + user pour la page publique
        enrich(registration, eventId, attendeeId);
        progress.refresh(registration);

        Registration saved = registrationRepository.save(registration);

        // Décrémente availableSeats sur l'event
        seatUpdater.decrement(eventId);

        // Publish event for notification-service
        notificationPublisher.publishRegistrationConfirmed(attendeeId, eventId, saved.getId());

        return saved;
    }

    public List<Registration> getAllRegistrations() {
        return refreshed(registrationRepository.findAll());
    }

    public List<Registration> getRegistrationsByEventId(String eventId) {
        return refreshed(registrationRepository.findByEventId(eventId));
    }

    /**
     * Remet l'avancement à jour avant affichage, et enregistre ce qui a bougé.
     *
     * <p>Le balayage périodique ({@link EventCompletionScheduler}) suffit à
     * prévenir les participants, mais pas à ce que la page soit juste : quelqu'un
     * qui ouvre son espace deux minutes après la fin d'une session doit y lire
     * « terminée », pas attendre le prochain passage du planificateur.</p>
     */
    private List<Registration> refreshed(List<Registration> regs) {
        List<Registration> changed = new java.util.ArrayList<>();
        for (Registration r : regs) {
            if (syncProgress(r)) changed.add(r);
        }
        if (!changed.isEmpty()) registrationRepository.saveAll(changed);
        return regs;
    }

    /**
     * Met une inscription à jour de son avancement, en la complétant d'abord si
     * elle est antérieure au suivi.
     *
     * <p>Une inscription d'avant cette fonctionnalité ne porte ni la durée de la
     * session ni le contact du participant. On la complète AVANT de calculer :
     * sinon une formation de trois jours serait close au bout de la journée type.
     * Une seule fois — {@code refresh} renseigne ensuite {@code progressStatus},
     * ce qui referme cette branche définitivement.</p>
     *
     * @return {@code true} si l'inscription a changé et doit être enregistrée
     */
    private boolean syncProgress(Registration r) {
        boolean migrating = r.getProgressStatus() == null;
        if (migrating) enrich(r, r.getEventId(), r.getAttendeeId());
        boolean refreshed = progress.refresh(r);
        return migrating || refreshed;
    }

    /**
     * Adresses des inscrits encore concernés par une session : les demandes en
     * attente et les inscriptions confirmées. Les annulées et les refusées sont
     * écartées — prévenir quelqu'un d'un changement sur une session qu'il a
     * quittée n'aurait aucun sens.
     *
     * <p>L'email n'est pas stocké sur l'inscription : il est résolu auprès du
     * user-service à partir de l'identifiant Keycloak, puis dédoublonné.</p>
     */
    public List<String> getActiveAttendeeEmails(String eventId) {
        java.util.Set<String> emails = new java.util.LinkedHashSet<>();
        for (Registration r : registrationRepository.findByEventId(eventId)) {
            String status = r.getStatus() == null ? "" : r.getStatus().toUpperCase();
            if ("CANCELLED".equals(status) || "REJECTED".equals(status)) continue;
            if (r.getAttendeeId() == null) continue;
            UserEnrichmentService.UserInfo u = userEnrichment.fetch(r.getAttendeeId());
            if (u != null && u.email != null && !u.email.isBlank()) emails.add(u.email.trim());
        }
        return new java.util.ArrayList<>(emails);
    }

    public List<Registration> getRegistrationsByAttendeeId(String attendeeId) {
        return refreshed(registrationRepository.findByAttendeeId(attendeeId));
    }

    public Optional<Registration> getRegistrationById(String id) {
        return registrationRepository.findById(id).map(r -> {
            if (syncProgress(r)) return registrationRepository.save(r);
            return r;
        });
    }

    public Registration cancelRegistration(String id) {
        return registrationRepository.findById(id).map(reg -> {
            // Ne libère la place que si elle était bien confirmée
            boolean wasConfirmed = "CONFIRMED".equals(reg.getStatus());
            reg.setStatus("CANCELLED");
            progress.refresh(reg);
            Registration saved = registrationRepository.save(reg);
            if (wasConfirmed) {
                seatUpdater.increment(saved.getEventId());
            }
            notificationPublisher.publishRegistrationCancelled(saved.getAttendeeId(), saved.getEventId(), saved.getId());
            return saved;
        }).orElseThrow(() -> new RuntimeException("Registration not found with id: " + id));
    }

    /** Résultat d'un check-in : statut + l'inscription concernée. */
    public static class CheckInResult {
        public String result; // OK | ALREADY | INVALID
        public Registration registration;
        public CheckInResult(String result, Registration registration) {
            this.result = result; this.registration = registration;
        }
    }

    /** Check-in le jour J : valide le billet à l'entrée (scan du QR). */
    public CheckInResult checkIn(String id) {
        Registration reg = registrationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Registration not found with id: " + id));
        // Billet annulé → invalide
        if (!"CONFIRMED".equals(reg.getStatus())) {
            return new CheckInResult("INVALID", reg);
        }
        // Déjà scanné → on signale (anti double-entrée)
        if (reg.isCheckedIn()) {
            return new CheckInResult("ALREADY", reg);
        }
        reg.setCheckedIn(true);
        reg.setCheckedInAt(java.time.LocalDateTime.now());
        // La présence validée fait avancer le participant dans son parcours.
        progress.refresh(reg);
        return new CheckInResult("OK", registrationRepository.save(reg));
    }

    /** Annule un check-in (erreur de scan). */
    public Registration undoCheckIn(String id) {
        return registrationRepository.findById(id).map(reg -> {
            reg.setCheckedIn(false);
            reg.setCheckedInAt(null);
            progress.refresh(reg);
            return registrationRepository.save(reg);
        }).orElseThrow(() -> new RuntimeException("Registration not found with id: " + id));
    }

    /** Recalcule availableSeats pour chaque event en fonction des CONFIRMED inscriptions. */
    public void resyncAllEventSeats() {
        Map<String, Long> confirmedByEvent = registrationRepository.findAll().stream()
            .filter(r -> "CONFIRMED".equals(r.getStatus()))
            .collect(java.util.stream.Collectors.groupingBy(Registration::getEventId, java.util.stream.Collectors.counting()));

        confirmedByEvent.forEach((eventId, count) -> {
            // Le seatUpdater cap entre [0, totalSeats]. On décrémente count fois pour aligner.
            for (int i = 0; i < count; i++) seatUpdater.decrement(eventId);
            System.out.println("[Resync] event=" + eventId + " : -" + count + " places");
        });
        System.out.println("[Resync] done for " + confirmedByEvent.size() + " event(s)");
    }

    // ═══════════════ Validation par le manager (workflow d'approbation) ═══════════════

    /** Crée une demande d'inscription EN ATTENTE de validation par un manager (statut PENDING). */
    public Registration requestApproval(String eventId, String attendeeId, String ticketType, Double ticketPrice) {
        if (registrationRepository.existsByEventIdAndAttendeeIdAndStatus(eventId, attendeeId, "CONFIRMED")
                || registrationRepository.existsByEventIdAndAttendeeIdAndStatus(eventId, attendeeId, "PENDING")) {
            throw new RuntimeException("Une inscription est déjà en cours pour cet événement.");
        }
        Registration r = new Registration();
        r.setEventId(eventId);
        r.setAttendeeId(attendeeId);
        r.setStatus("PENDING");
        r.setTicketType(ticketType);
        r.setTicketPrice(ticketPrice);
        r.setQrCodeTicket("QR-" + UUID.randomUUID() + "-" + eventId + "-" + attendeeId);
        enrich(r, eventId, attendeeId);
        Registration saved = registrationRepository.save(r);
        // Accusé de réception au participant : demande enregistrée, en attente de validation.
        notificationPublisher.publishRegistrationRequested(attendeeId, eventId, saved.getId());
        return saved;
    }

    /** Le manager approuve : passage CONFIRMED, place décomptée, email de confirmation. */
    public Registration approve(String id) {
        return registrationRepository.findById(id).map(reg -> {
            if (!"PENDING".equals(reg.getStatus())) {
                throw new RuntimeException("Seule une inscription en attente peut être approuvée.");
            }
            reg.setStatus("CONFIRMED");
            progress.refresh(reg);
            Registration saved = registrationRepository.save(reg);
            seatUpdater.decrement(saved.getEventId());
            notificationPublisher.publishRegistrationConfirmed(saved.getAttendeeId(), saved.getEventId(), saved.getId());
            return saved;
        }).orElseThrow(() -> new RuntimeException("Inscription introuvable : " + id));
    }

    /** Le manager refuse la demande (statut REJECTED). Le participant est prévenu. */
    public Registration reject(String id) {
        return registrationRepository.findById(id).map(reg -> {
            reg.setStatus("REJECTED");
            progress.refresh(reg);
            Registration saved = registrationRepository.save(reg);
            notificationPublisher.publishRegistrationRejected(saved.getAttendeeId(), saved.getEventId(), saved.getId());
            return saved;
        }).orElseThrow(() -> new RuntimeException("Inscription introuvable : " + id));
    }

    /** Inscriptions en attente de validation (vue manager). */
    public List<Registration> getPending() {
        return registrationRepository.findByStatus("PENDING");
    }

    // ═══════════════ Certificats de participation ═══════════════

    /**
     * File des certificats à traiter par l'administrateur : sessions terminées
     * dont le certificat est en préparation ou volontairement différé.
     * Les inscriptions annulées ou refusées n'y figurent jamais.
     *
     * <p>La file est recalculée avant lecture plutôt que lue telle quelle : une
     * session qui vient de se terminer doit y apparaître immédiatement, sans
     * attendre le prochain passage du planificateur.</p>
     */
    public List<Registration> getPendingCertificates() {
        return refreshed(registrationRepository.findAll()).stream()
                .filter(r -> "CONFIRMED".equalsIgnoreCase(r.getStatus()))
                .filter(r -> CERT_TODO.contains(String.valueOf(r.getCertificateStatus()).toUpperCase()))
                .sorted(java.util.Comparator.comparing(
                        Registration::getCompletedAt,
                        java.util.Comparator.nullsLast(java.util.Comparator.reverseOrder())))
                .toList();
    }

    /**
     * L'administrateur envoie le certificat : il devient téléchargeable par le
     * participant, qui en est prévenu par email et notification in-app.
     */
    public Registration sendCertificate(String id, String handledBy) {
        Registration reg = requireRegistration(id);
        if (!"CONFIRMED".equalsIgnoreCase(reg.getStatus())) {
            throw new IllegalStateException("Seule une inscription confirmée donne droit à un certificat.");
        }
        String cert = reg.getCertificateStatus() == null ? "" : reg.getCertificateStatus().toUpperCase();
        if ("NOT_AVAILABLE".equals(cert) || cert.isEmpty()) {
            throw new IllegalStateException("La session n'est pas terminée : le certificat n'est pas encore préparé.");
        }
        if ("SENT".equals(cert)) return reg;   // déjà envoyé — l'action est idempotente

        reg.setCertificateStatus("SENT");
        reg.setCertificateSentAt(java.time.LocalDateTime.now());
        reg.setCertificateHandledBy(handledBy);
        Registration saved = registrationRepository.save(reg);
        notificationPublisher.publishCertificateSent(saved);
        return saved;
    }

    /**
     * L'administrateur diffère l'envoi : le certificat reste dans sa file, le
     * participant voit qu'il attend une validation.
     */
    public Registration holdCertificate(String id, String handledBy) {
        Registration reg = requireRegistration(id);
        String cert = reg.getCertificateStatus() == null ? "" : reg.getCertificateStatus().toUpperCase();
        if ("NOT_AVAILABLE".equals(cert) || cert.isEmpty()) {
            throw new IllegalStateException("La session n'est pas terminée : rien à différer.");
        }
        if ("SENT".equals(cert)) {
            throw new IllegalStateException("Le certificat a déjà été envoyé au participant.");
        }
        reg.setCertificateStatus("PENDING_APPROVAL");
        reg.setCertificateHandledBy(handledBy);
        return registrationRepository.save(reg);
    }

    /**
     * Envoi groupé pour une session terminée : l'administrateur tranche en une
     * fois pour toute une promotion. Les certificats déjà envoyés sont ignorés.
     *
     * @return nombre de certificats effectivement envoyés
     */
    public int sendCertificatesForEvent(String eventId, String handledBy) {
        int sent = 0;
        for (Registration reg : registrationRepository.findByEventId(eventId)) {
            if (!"CONFIRMED".equalsIgnoreCase(reg.getStatus())) continue;
            String cert = reg.getCertificateStatus() == null ? "" : reg.getCertificateStatus().toUpperCase();
            if (!CERT_TODO.contains(cert)) continue;
            try { sendCertificate(reg.getId(), handledBy); sent++; }
            catch (RuntimeException e) {
                System.err.println("[Certificat] envoi impossible pour " + reg.getId() + " : " + e.getMessage());
            }
        }
        return sent;
    }

    /** Le participant peut-il télécharger son certificat ? */
    public boolean isCertificateDownloadable(Registration reg) {
        return "CONFIRMED".equalsIgnoreCase(reg.getStatus())
                && "SENT".equalsIgnoreCase(String.valueOf(reg.getCertificateStatus()));
    }

    private Registration requireRegistration(String id) {
        return registrationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Inscription introuvable : " + id));
    }

    // ═══════════════ Statistiques / analytics ═══════════════

    /** KPIs globaux d'inscription + taux de présence / no-show. */
    public Map<String, Object> globalStats() {
        long confirmed = registrationRepository.countByStatus("CONFIRMED");
        long cancelled = registrationRepository.countByStatus("CANCELLED");
        long pending = registrationRepository.countByStatus("PENDING");
        long checkedIn = registrationRepository.countCheckedIn(true);
        long total = registrationRepository.count();
        int presenceRate = confirmed > 0 ? (int) Math.round(checkedIn * 100.0 / confirmed) : 0;
        int noShowRate = confirmed > 0 ? (int) Math.round((confirmed - checkedIn) * 100.0 / confirmed) : 0;
        Map<String, Object> m = new HashMap<>();
        m.put("total", total);
        m.put("confirmed", confirmed);
        m.put("cancelled", cancelled);
        m.put("pending", pending);
        m.put("checkedIn", checkedIn);
        m.put("presenceRate", presenceRate);
        m.put("noShowRate", noShowRate);
        return m;
    }

    /** Historique de formation d'un collaborateur (nb sessions, présences, annulations). */
    public Map<String, Object> attendeeStats(String attendeeId) {
        List<Registration> regs = registrationRepository.findByAttendeeId(attendeeId);
        long confirmed = regs.stream().filter(r -> "CONFIRMED".equals(r.getStatus())).count();
        long attended = regs.stream().filter(Registration::isCheckedIn).count();
        long cancelled = regs.stream().filter(r -> "CANCELLED".equals(r.getStatus())).count();
        Map<String, Object> m = new HashMap<>();
        m.put("attendeeId", attendeeId);
        m.put("totalRegistrations", regs.size());
        m.put("confirmed", confirmed);
        m.put("attended", attended);
        m.put("cancelled", cancelled);
        return m;
    }

    /** Enrichit les champs dénormalisés (event + user) — best-effort. */
    private void enrich(Registration r, String eventId, String attendeeId) {
        try {
            EventEnrichmentService.EventInfo e = eventEnrichment.fetch(eventId);
            if (e != null) {
                r.setEventTitle(e.title);
                r.setEventLocation(e.location);
                r.setEventDateStr(e.eventDate != null ? e.eventDate.toString() : null);
                r.setEventDurationStr(e.duration);
            }
            UserEnrichmentService.UserInfo u = userEnrichment.fetch(attendeeId);
            if (u != null) {
                String name = ((u.firstName != null ? u.firstName : "") + " " + (u.lastName != null ? u.lastName : "")).trim();
                r.setAttendeeName(name.isEmpty() ? u.email : name);
                r.setAttendeeEmail(u.email);
                r.setAttendeeFirstName(u.firstName);
            }
        } catch (Exception ignored) {}
    }
}
