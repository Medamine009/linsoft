package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.repositories.RegistrationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Cycle de vie d'une inscription : demande, validation, présence, annulation.
 *
 * <p>Ces règles gouvernent la disponibilité des places et ce que le participant
 * reçoit par email. Une erreur ici se traduit soit par des places fantômes, soit
 * par un collaborateur prévenu à tort.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RegistrationLifecycleTest {

    @Mock RegistrationRepository registrationRepository;
    @Mock NotificationPublisher notificationPublisher;
    @Mock EventSeatUpdater seatUpdater;
    @Mock UserEnrichmentService userEnrichment;
    @Mock EventEnrichmentService eventEnrichment;
    @Mock ParticipationProgressService progress;
    @InjectMocks RegistrationService service;

    private Registration reg(String id, String status) {
        Registration r = new Registration();
        r.setId(id);
        r.setEventId("ev-1");
        r.setAttendeeId("u1");
        r.setStatus(status);
        r.setProgressStatus("NOT_STARTED");   // fiche non héritée : pas de ré-enrichissement
        return r;
    }

    private UserEnrichmentService.UserInfo user(String email) {
        UserEnrichmentService.UserInfo u = new UserEnrichmentService.UserInfo();
        u.email = email;
        u.firstName = "Yassine";
        u.lastName = "Gharbi";
        return u;
    }

    // ═══════════ Demande d'inscription ═══════════

    @Test
    void requestApproval_createsAPendingRequestAndAcknowledgesIt() {
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        Registration r = service.requestApproval("ev-1", "u1", "Standard", 0.0);

        assertEquals("PENDING", r.getStatus());
        assertNotNull(r.getQrCodeTicket());
        // Accusé de réception : le participant doit savoir que sa demande est partie.
        verify(notificationPublisher).publishRegistrationRequested("u1", "ev-1", r.getId());
        // Aucune place n'est décomptée tant que l'admin n'a pas validé.
        verify(seatUpdater, never()).decrement(anyString());
    }

    @Test
    void requestApproval_refusesWhenAlreadyConfirmedOrPending() {
        when(registrationRepository.existsByEventIdAndAttendeeIdAndStatus("ev-1", "u1", "CONFIRMED")).thenReturn(true);
        assertThrows(RuntimeException.class, () -> service.requestApproval("ev-1", "u1", null, null));

        reset(registrationRepository);
        when(registrationRepository.existsByEventIdAndAttendeeIdAndStatus("ev-1", "u1", "PENDING")).thenReturn(true);
        assertThrows(RuntimeException.class, () -> service.requestApproval("ev-1", "u1", null, null));

        verify(registrationRepository, never()).save(any());
    }

    // ═══════════ Validation par l'administrateur ═══════════

    @Test
    void approve_confirmsDecrementsSeatAndNotifies() {
        Registration pending = reg("r1", "PENDING");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(pending));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        Registration confirmed = service.approve("r1");

        assertEquals("CONFIRMED", confirmed.getStatus());
        verify(seatUpdater).decrement("ev-1");
        verify(notificationPublisher).publishRegistrationConfirmed("u1", "ev-1", "r1");
    }

    @Test
    void approve_refusesAnythingButAPendingRequest() {
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg("r1", "CONFIRMED")));

        // Ré-approuver une inscription déjà confirmée décrémenterait une place
        // une seconde fois : la garde est essentielle.
        assertThrows(RuntimeException.class, () -> service.approve("r1"));
        verify(seatUpdater, never()).decrement(anyString());
    }

    @Test
    void reject_marksTheRequestAndInformsTheApplicant() {
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg("r1", "PENDING")));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("REJECTED", service.reject("r1").getStatus());
        verify(notificationPublisher).publishRegistrationRejected("u1", "ev-1", "r1");
        // Aucune place n'était réservée : rien à rendre.
        verify(seatUpdater, never()).increment(anyString());
    }

    // ═══════════ Annulation ═══════════

    @Test
    void cancel_releasesTheSeatOnlyWhenItWasConfirmed() {
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg("r1", "CONFIRMED")));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("CANCELLED", service.cancelRegistration("r1").getStatus());
        verify(seatUpdater).increment("ev-1");
    }

    @Test
    void cancel_ofAPendingRequestDoesNotGiveBackASeatItNeverTook() {
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg("r1", "PENDING")));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        service.cancelRegistration("r1");

        // Sans cette distinction, annuler une demande en attente créerait une
        // place qui n'a jamais existé.
        verify(seatUpdater, never()).increment(anyString());
        verify(notificationPublisher).publishRegistrationCancelled("u1", "ev-1", "r1");
    }

    @Test
    void cancel_failsOnUnknownRegistration() {
        when(registrationRepository.findById("inconnu")).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class, () -> service.cancelRegistration("inconnu"));
    }

    // ═══════════ Présence (check-in le jour J) ═══════════

    @Test
    void checkIn_validatesAConfirmedTicketOnce() {
        Registration confirmed = reg("r1", "CONFIRMED");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(confirmed));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        RegistrationService.CheckInResult result = service.checkIn("r1");

        assertEquals("OK", result.result);
        assertTrue(result.registration.isCheckedIn());
        assertNotNull(result.registration.getCheckedInAt());
    }

    @Test
    void checkIn_reportsASecondScanInsteadOfAcceptingIt() {
        Registration already = reg("r1", "CONFIRMED");
        already.setCheckedIn(true);
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(already));

        // Anti double-entrée : l'agent d'accueil doit voir que le billet a déjà servi.
        assertEquals("ALREADY", service.checkIn("r1").result);
        verify(registrationRepository, never()).save(any());
    }

    @Test
    void checkIn_refusesACancelledTicket() {
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg("r1", "CANCELLED")));

        assertEquals("INVALID", service.checkIn("r1").result);
        verify(registrationRepository, never()).save(any());
    }

    @Test
    void undoCheckIn_clearsAScanningMistake() {
        Registration scanned = reg("r1", "CONFIRMED");
        scanned.setCheckedIn(true);
        scanned.setCheckedInAt(java.time.LocalDateTime.now());
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(scanned));
        when(registrationRepository.save(any(Registration.class))).thenAnswer(i -> i.getArgument(0));

        Registration undone = service.undoCheckIn("r1");

        assertFalse(undone.isCheckedIn());
        assertNull(undone.getCheckedInAt());
    }

    // ═══════════ Destinataires d'une session ═══════════

    @Test
    void activeAttendeeEmails_excludeCancelledAndRejectedAndDeduplicate() {
        Registration confirmed = reg("r1", "CONFIRMED");
        Registration pending = reg("r2", "PENDING");   pending.setAttendeeId("u2");
        Registration cancelled = reg("r3", "CANCELLED"); cancelled.setAttendeeId("u3");
        Registration rejected = reg("r4", "REJECTED");  rejected.setAttendeeId("u4");
        Registration duplicate = reg("r5", "CONFIRMED"); duplicate.setAttendeeId("u5");
        when(registrationRepository.findByEventId("ev-1"))
                .thenReturn(List.of(confirmed, pending, cancelled, rejected, duplicate));

        when(userEnrichment.fetch("u1")).thenReturn(user("a@linsoft.tn"));
        when(userEnrichment.fetch("u2")).thenReturn(user("b@linsoft.tn"));
        when(userEnrichment.fetch("u3")).thenReturn(user("annule@linsoft.tn"));
        when(userEnrichment.fetch("u4")).thenReturn(user("refuse@linsoft.tn"));
        when(userEnrichment.fetch("u5")).thenReturn(user("a@linsoft.tn"));   // doublon

        List<String> emails = service.getActiveAttendeeEmails("ev-1");

        // Prévenir quelqu'un d'un changement sur une session qu'il a quittée
        // n'aurait aucun sens ; et personne ne doit recevoir deux fois le message.
        assertEquals(2, emails.size());
        assertTrue(emails.contains("a@linsoft.tn"));
        assertTrue(emails.contains("b@linsoft.tn"));
        assertFalse(emails.contains("annule@linsoft.tn"));
        assertFalse(emails.contains("refuse@linsoft.tn"));
    }

    @Test
    void activeAttendeeEmails_skipUnresolvableAccounts() {
        Registration orphan = reg("r1", "CONFIRMED");
        when(registrationRepository.findByEventId("ev-1")).thenReturn(List.of(orphan));
        when(userEnrichment.fetch("u1")).thenReturn(null);   // compte supprimé

        assertTrue(service.getActiveAttendeeEmails("ev-1").isEmpty());
    }

    // ═══════════ Statistiques ═══════════

    @Test
    void globalStats_computeAttendanceAndNoShowRates() {
        when(registrationRepository.countByStatus("CONFIRMED")).thenReturn(10L);
        when(registrationRepository.countByStatus("CANCELLED")).thenReturn(2L);
        when(registrationRepository.countByStatus("PENDING")).thenReturn(3L);
        when(registrationRepository.countCheckedIn(true)).thenReturn(7L);
        when(registrationRepository.count()).thenReturn(15L);

        Map<String, Object> stats = service.globalStats();

        assertEquals(10L, stats.get("confirmed"));
        assertEquals(7L, stats.get("checkedIn"));
        assertEquals(70, stats.get("presenceRate"));
        assertEquals(30, stats.get("noShowRate"));
    }

    @Test
    void globalStats_avoidDivisionByZeroWhenNothingIsConfirmed() {
        when(registrationRepository.countByStatus(anyString())).thenReturn(0L);
        when(registrationRepository.countCheckedIn(true)).thenReturn(0L);
        when(registrationRepository.count()).thenReturn(0L);

        Map<String, Object> stats = service.globalStats();

        assertEquals(0, stats.get("presenceRate"));
        assertEquals(0, stats.get("noShowRate"));
    }

    @Test
    void attendeeStats_summariseOneCollaboratorHistory() {
        Registration confirmed = reg("r1", "CONFIRMED"); confirmed.setCheckedIn(true);
        Registration cancelled = reg("r2", "CANCELLED");
        Registration other = reg("r3", "CONFIRMED");
        when(registrationRepository.findByAttendeeId("u1")).thenReturn(List.of(confirmed, cancelled, other));

        Map<String, Object> stats = service.attendeeStats("u1");

        assertEquals(3, stats.get("totalRegistrations"));
        assertEquals(2L, stats.get("confirmed"));
        assertEquals(1L, stats.get("attended"));
        assertEquals(1L, stats.get("cancelled"));
    }

    // ═══════════ Certificat — garde-fou d'état ═══════════

    @Test
    void isCertificateDownloadable_onlyForAConfirmedAndSentCertificate() {
        Registration sent = reg("r1", "CONFIRMED");
        sent.setCertificateStatus("SENT");
        assertTrue(service.isCertificateDownloadable(sent));

        Registration preparing = reg("r2", "CONFIRMED");
        preparing.setCertificateStatus("IN_PREPARATION");
        assertFalse(service.isCertificateDownloadable(preparing));

        Registration cancelledButSent = reg("r3", "CANCELLED");
        cancelledButSent.setCertificateStatus("SENT");
        assertFalse(service.isCertificateDownloadable(cancelledButSent));
    }

    @Test
    void holdCertificate_refusesOneAlreadyDelivered() {
        Registration sent = reg("r1", "CONFIRMED");
        sent.setCertificateStatus("SENT");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(sent));

        // On ne peut pas « remettre en attente » ce que le participant a déjà reçu.
        assertThrows(IllegalStateException.class, () -> service.holdCertificate("r1", "admin"));
    }

    @Test
    void sendCertificate_isIdempotent() {
        Registration sent = reg("r1", "CONFIRMED");
        sent.setCertificateStatus("SENT");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(sent));

        Registration again = service.sendCertificate("r1", "admin");

        assertEquals("SENT", again.getCertificateStatus());
        // Un double clic ne doit pas renvoyer un second email au participant.
        verify(notificationPublisher, never()).publishCertificateSent(any());
        verify(registrationRepository, never()).save(any());
    }
}
