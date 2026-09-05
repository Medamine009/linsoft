package com.pfe.events.eventservice.services;

import com.pfe.events.eventservice.entities.Event;
import com.pfe.events.eventservice.entities.Event.PendingChange;
import com.pfe.events.eventservice.repositories.EventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Demandes de modification et d'annulation sur une session publiée.
 *
 * <p>C'est la partie la plus délicate du catalogue : des collaborateurs sont déjà
 * inscrits, donc rien ne doit changer sans décision de l'administrateur, et
 * l'approbation doit dire précisément aux inscrits ce qui a changé.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class EventChangeServiceTest {

    @Mock EventRepository eventRepository;
    @Mock ParticipantNotifier participantNotifier;

    EventChangeService service;

    private static final String ORGANIZER = "kc-karim";
    private static final String AUTRE_ORGANIZER = "kc-nadia";

    private Event published() {
        Event e = new Event();
        e.setId("ev-1");
        e.setTitle("Kubernetes Administrator (CKA)");
        e.setDescription("Parcours certifiant");
        e.setEventDate(LocalDateTime.of(2026, 8, 17, 9, 0));
        e.setLocation("LINSOFT Academy — Tunis");
        e.setCategory("Kubernetes");
        e.setMode("PRESENTIEL");
        e.setStatus("APPROVED");
        e.setOrganizerId(ORGANIZER);
        e.setOrganizerName("Karim Haddad");
        e.setTotalSeats(14);
        e.setAvailableSeats(9);          // 5 places déjà réservées
        return e;
    }

    @BeforeEach
    void setUp() {
        service = new EventChangeService(eventRepository, participantNotifier);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(published()));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));
    }

    // ═══════════ Dépôt d'une demande ═══════════

    @Test
    void requestUpdate_storesProposalWithoutTouchingThePublishedSession() {
        PendingChange proposed = new PendingChange();
        proposed.setTitle("CKA — session renforcée");

        Event result = service.requestUpdate("ev-1", proposed, ORGANIZER);

        assertNotNull(result.getPendingChange());
        assertEquals("UPDATE", result.getPendingChange().getType());
        assertEquals(ORGANIZER, result.getPendingChange().getRequestedBy());
        assertEquals("Karim Haddad", result.getPendingChange().getRequestedByName());
        // L'essentiel : la session publiée est inchangée tant que l'admin n'a pas tranché.
        assertEquals("Kubernetes Administrator (CKA)", result.getTitle());
    }

    @Test
    void requestUpdate_refusesASessionThatIsNotYours() {
        PendingChange proposed = new PendingChange();
        proposed.setTitle("Tentative");

        assertThrows(SecurityException.class,
                () -> service.requestUpdate("ev-1", proposed, AUTRE_ORGANIZER));
        verify(eventRepository, never()).save(any());
    }

    @Test
    void requestUpdate_refusesASecondPendingRequest() {
        Event withPending = published();
        withPending.setPendingChange(new PendingChange());
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        assertThrows(IllegalStateException.class,
                () -> service.requestUpdate("ev-1", new PendingChange(), ORGANIZER));
    }

    @Test
    void requestUpdate_refusesACancelledSession() {
        Event cancelled = published();
        cancelled.setStatus("CANCELLED");
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(cancelled));

        assertThrows(IllegalStateException.class,
                () -> service.requestUpdate("ev-1", new PendingChange(), ORGANIZER));
    }

    @Test
    void requestCancel_requiresAReason() {
        // Le motif est repris tel quel dans l'email aux inscrits : sans lui, ils
        // apprendraient l'annulation sans explication.
        assertThrows(IllegalArgumentException.class, () -> service.requestCancel("ev-1", null, ORGANIZER));
        assertThrows(IllegalArgumentException.class, () -> service.requestCancel("ev-1", "   ", ORGANIZER));
        verify(eventRepository, never()).save(any());
    }

    @Test
    void requestCancel_storesTrimmedReason() {
        Event result = service.requestCancel("ev-1", "  Formateur indisponible  ", ORGANIZER);

        assertEquals("CANCEL", result.getPendingChange().getType());
        assertEquals("Formateur indisponible", result.getPendingChange().getReason());
        assertEquals("APPROVED", result.getStatus(), "la session reste publiée jusqu'à la décision");
    }

    @Test
    void withdraw_clearsTheOrganiserOwnRequest() {
        Event withPending = published();
        withPending.setPendingChange(new PendingChange());
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        assertNull(service.withdraw("ev-1", ORGANIZER).getPendingChange());
    }

    @Test
    void withdraw_refusesASessionThatIsNotYours() {
        assertThrows(SecurityException.class, () -> service.withdraw("ev-1", AUTRE_ORGANIZER));
    }

    // ═══════════ Décision de l'administrateur ═══════════

    @Test
    void approve_appliesTheProposedValuesAndDescribesTheChange() {
        Event withPending = published();
        PendingChange c = new PendingChange();
        c.setTitle("CKA — édition renforcée");
        c.setLocation("LINSOFT Academy — Sfax");
        c.setEventDate(LocalDateTime.of(2026, 9, 2, 14, 0));
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        Event result = service.approve("ev-1");

        assertEquals("CKA — édition renforcée", result.getTitle());
        assertEquals("LINSOFT Academy — Sfax", result.getLocation());
        assertEquals(LocalDateTime.of(2026, 9, 2, 14, 0), result.getEventDate());
        assertNull(result.getPendingChange(), "la demande est consommée");
        assertEquals("APPROVED", result.getLastChangeDecision().getOutcome());

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(participantNotifier).notifyParticipants(eq("ev-1"), anyString(), message.capture());
        // Le message doit énoncer précisément ce qui change, pas un vague « mise à jour ».
        assertTrue(message.getValue().contains("Intitulé"));
        assertTrue(message.getValue().contains("Lieu"));
        assertTrue(message.getValue().contains("Date"));
    }

    @Test
    void approve_leavesUnsetFieldsUntouched() {
        Event withPending = published();
        PendingChange c = new PendingChange();
        c.setLocation("LINSOFT Academy — Sfax");   // seul le lieu change
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        Event result = service.approve("ev-1");

        // Un champ null signifie « inchangé » : l'organisateur ne renvoie pas tout.
        assertEquals("Kubernetes Administrator (CKA)", result.getTitle());
        assertEquals("Kubernetes", result.getCategory());
    }

    @Test
    void approve_preservesAlreadyReservedSeatsWhenCapacityChanges() {
        Event withPending = published();          // 14 places, 9 libres -> 5 réservées
        PendingChange c = new PendingChange();
        c.setTotalSeats(20);
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        Event result = service.approve("ev-1");

        assertEquals(20, result.getTotalSeats());
        // 20 - 5 réservées : augmenter la capacité ne doit pas libérer les places prises.
        assertEquals(15, result.getAvailableSeats());
    }

    @Test
    void approve_neverLetsAvailableSeatsGoNegative() {
        Event withPending = published();          // 5 réservées
        PendingChange c = new PendingChange();
        c.setTotalSeats(3);                       // capacité réduite sous le nombre d'inscrits
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        assertEquals(0, service.approve("ev-1").getAvailableSeats());
    }

    @Test
    void approve_ofACancellationClosesTheSessionAndExplainsWhy() {
        Event withPending = published();
        PendingChange c = new PendingChange();
        c.setType("CANCEL");
        c.setReason("Formateur indisponible");
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        Event result = service.approve("ev-1");

        assertEquals("CANCELLED", result.getStatus());
        assertEquals("Formateur indisponible", result.getCancelReason());

        ArgumentCaptor<String> message = ArgumentCaptor.forClass(String.class);
        verify(participantNotifier).notifyParticipants(eq("ev-1"), anyString(), message.capture());
        assertTrue(message.getValue().contains("Formateur indisponible"));
    }

    @Test
    void approve_failsWhenThereIsNoPendingRequest() {
        assertThrows(IllegalStateException.class, () -> service.approve("ev-1"));
        verify(participantNotifier, never()).notifyParticipants(anyString(), anyString(), anyString());
    }

    @Test
    void approve_keepsTheDecisionEvenIfNotifyingParticipantsFails() {
        Event withPending = published();
        PendingChange c = new PendingChange();
        c.setTitle("Nouveau titre");
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));
        doThrow(new RuntimeException("SMTP indisponible"))
                .when(participantNotifier).notifyParticipants(anyString(), anyString(), anyString());

        // La décision est déjà enregistrée : une panne d'email ne doit pas
        // la faire échouer, sinon l'admin croirait n'avoir rien validé.
        Event result = assertDoesNotThrow(() -> service.approve("ev-1"));
        assertEquals("Nouveau titre", result.getTitle());
        assertNull(result.getPendingChange());
    }

    @Test
    void reject_leavesTheSessionUntouchedAndDoesNotDisturbParticipants() {
        Event withPending = published();
        PendingChange c = new PendingChange();
        c.setType("UPDATE");
        c.setTitle("Titre refusé");
        c.setReason("Motif");
        withPending.setPendingChange(c);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(withPending));

        Event result = service.reject("ev-1");

        assertEquals("Kubernetes Administrator (CKA)", result.getTitle());
        assertNull(result.getPendingChange());
        assertEquals("REJECTED", result.getLastChangeDecision().getOutcome());
        assertEquals("UPDATE", result.getLastChangeDecision().getType());
        verify(participantNotifier, never()).notifyParticipants(anyString(), anyString(), anyString());
    }

    @Test
    void reject_failsWhenThereIsNoPendingRequest() {
        assertThrows(IllegalStateException.class, () -> service.reject("ev-1"));
    }

    @Test
    void acknowledgeDecision_clearsTheNoticeForItsOwner() {
        Event decided = published();
        Event.ChangeDecision d = new Event.ChangeDecision();
        d.setOutcome("REJECTED");
        decided.setLastChangeDecision(d);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(decided));

        assertNull(service.acknowledgeDecision("ev-1", ORGANIZER).getLastChangeDecision());
        assertThrows(SecurityException.class, () -> service.acknowledgeDecision("ev-1", AUTRE_ORGANIZER));
    }

    // ═══════════ File de modération ═══════════

    @Test
    void pendingChanges_returnsOnlySessionsAwaitingADecision() {
        Event withPending = published();
        withPending.setPendingChange(new PendingChange());
        Event withoutPending = published();
        when(eventRepository.findAll()).thenReturn(List.of(withPending, withoutPending));

        List<Event> queue = service.pendingChanges();

        assertEquals(1, queue.size());
        assertNotNull(queue.get(0).getPendingChange());
    }

    @Test
    void anAdminActsWithoutOwnershipRestriction() {
        // requesterId null = administrateur : il agit sur toute session.
        Event result = service.requestCancel("ev-1", "Décision de la direction", null);
        assertEquals("CANCEL", result.getPendingChange().getType());
    }

    @Test
    void loadingAnUnknownSessionFails() {
        when(eventRepository.findById("inconnu")).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class, () -> service.approve("inconnu"));
    }
}
