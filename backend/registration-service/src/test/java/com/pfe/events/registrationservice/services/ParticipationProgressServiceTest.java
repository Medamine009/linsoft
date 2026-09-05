package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ParticipationProgressServiceTest {

    private final ParticipationProgressService progress = new ParticipationProgressService();

    private Registration confirmed(String startsAt, String duration) {
        Registration r = new Registration();
        r.setId("r1");
        r.setStatus("CONFIRMED");
        r.setEventDateStr(startsAt);
        r.setEventDurationStr(duration);
        return r;
    }

    // ─── Durées libellées librement par le formateur ───

    @Test
    void parseDuration_readsCommonFrenchLabels() {
        assertEquals(Duration.ofDays(3), progress.parseDuration("3 jours"));
        assertEquals(Duration.ofHours(4), progress.parseDuration("4 heures"));
        assertEquals(Duration.ofMinutes(90), progress.parseDuration("90 min"));
        assertEquals(Duration.ofDays(7), progress.parseDuration("1 semaine"));
        assertEquals(Duration.ofHours(4), progress.parseDuration("Une demi-journée"));
        assertEquals(Duration.ofHours(2).plusMinutes(30), progress.parseDuration("2h30"));
    }

    @Test
    void parseDuration_fallsBackOnUnreadableLabels() {
        Duration fallback = Duration.ofHours(8);
        assertEquals(fallback, progress.parseDuration(null));
        assertEquals(fallback, progress.parseDuration("   "));
        assertEquals(fallback, progress.parseDuration("à préciser"));
    }

    // ─── Avancement ───

    @Test
    void refresh_marksUpcomingSessionAsNotStarted() {
        Registration r = confirmed(LocalDateTime.now().plusDays(5).toString(), "4 heures");

        assertTrue(progress.refresh(r));
        assertEquals("NOT_STARTED", r.getProgressStatus());
        assertEquals(25, r.getProgressPercent());
        assertEquals("NOT_AVAILABLE", r.getCertificateStatus());
    }

    @Test
    void refresh_advancesWhenAttendanceIsValidated() {
        Registration r = confirmed(LocalDateTime.now().minusHours(1).toString(), "4 heures");
        r.setCheckedIn(true);

        progress.refresh(r);

        assertEquals("IN_PROGRESS", r.getProgressStatus());
        assertEquals(75, r.getProgressPercent());
        assertEquals("NOT_AVAILABLE", r.getCertificateStatus());
    }

    @Test
    void refresh_completesFinishedSessionAndPreparesCertificate() {
        Registration r = confirmed(LocalDateTime.now().minusDays(2).toString(), "4 heures");
        r.setCheckedIn(true);

        progress.refresh(r);

        assertEquals("COMPLETED", r.getProgressStatus());
        assertEquals(100, r.getProgressPercent());
        assertEquals("IN_PREPARATION", r.getCertificateStatus());
        assertNotNull(r.getCompletedAt());
    }

    @Test
    void refresh_neverReopensACertificateAlreadyDecided() {
        Registration r = confirmed(LocalDateTime.now().minusDays(2).toString(), "4 heures");
        r.setCertificateStatus("SENT");

        progress.refresh(r);

        assertEquals("SENT", r.getCertificateStatus());
    }

    @Test
    void refresh_leavesCancelledRegistrationsOutOfTheCertificateFlow() {
        Registration r = confirmed(LocalDateTime.now().minusDays(2).toString(), "4 heures");
        r.setStatus("CANCELLED");

        progress.refresh(r);

        assertEquals("CANCELLED", r.getProgressStatus());
        assertEquals(0, r.getProgressPercent());
        assertEquals("NOT_AVAILABLE", r.getCertificateStatus());
    }

    @Test
    void steps_flagAttendanceAsMissedOnceTheSessionIsOver() {
        Registration r = confirmed(LocalDateTime.now().minusDays(2).toString(), "4 heures");

        List<ParticipationProgressService.Step> steps = progress.steps(r);

        assertEquals(4, steps.size());
        assertTrue(steps.get(0).done, "inscription validée");
        assertTrue(steps.get(1).done, "session démarrée");
        assertFalse(steps.get(2).done, "présence non scannée");
        assertTrue(steps.get(2).missed, "absence signalée une fois la session close");
        assertTrue(steps.get(3).done, "session terminée");
    }
}
