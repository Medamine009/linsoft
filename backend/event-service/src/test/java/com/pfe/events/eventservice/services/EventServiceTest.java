package com.pfe.events.eventservice.services;

import com.pfe.events.eventservice.entities.Event;
import com.pfe.events.eventservice.repositories.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {

    @Mock EventRepository eventRepository;
    @Mock NotificationPublisher notificationPublisher;
    @InjectMocks EventService service;

    @Test
    void createEvent_setsPendingStatus_andPublishesNotification() {
        Event e = new Event();
        e.setTitle("Formation AWS");
        e.setTotalSeats(20);
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        Event saved = service.createEvent(e);

        assertEquals("PENDING", saved.getStatus());       // modération avant publication
        assertEquals(20, saved.getAvailableSeats());       // places initialisées
        verify(notificationPublisher).publishEventSubmitted(any(Event.class));
    }

    @Test
    void createEvent_byAdmin_isApprovedImmediately() {
        Event e = new Event();
        e.setTitle("Conférence OpenShift");
        e.setTotalSeats(80);
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        Event saved = service.createEvent(e, true);

        assertEquals("APPROVED", saved.getStatus());        // publiée sans modération
        verify(notificationPublisher).publishEventPublished(any(Event.class));
        verify(notificationPublisher, never()).publishEventSubmitted(any(Event.class));
    }

    @Test
    void createEvent_byOrganizer_ignoresForgedApprovedStatus() {
        Event e = new Event();
        e.setTitle("Workshop Ansible");
        e.setStatus("APPROVED");                            // statut soufflé par le client
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        Event saved = service.createEvent(e, false);

        assertEquals("PENDING", saved.getStatus());         // la modération reste incontournable
    }

    @Test
    void getPublishedEvents_keepsApprovedAndLegacyNull_dropsPending() {
        Event approved = new Event(); approved.setStatus("APPROVED");
        Event legacy = new Event();   legacy.setStatus(null);
        Event pending = new Event();  pending.setStatus("PENDING");
        when(eventRepository.findAll()).thenReturn(List.of(approved, legacy, pending));

        List<Event> published = service.getPublishedEvents();

        assertEquals(2, published.size());
        assertTrue(published.stream().noneMatch(ev -> "PENDING".equals(ev.getStatus())));
    }

    // ═══════════ Billetterie ═══════════

    @Test
    void createEvent_derivesCapacityAndEntryPriceFromTicketTypes() {
        Event e = new Event();
        e.setTitle("DevSecOps Day");
        e.setTotalSeats(10);                       // sera écrasé par la somme des quotas
        e.setTicketTypes(List.of(
                new Event.TicketType("Standard", 90.0, 60),
                new Event.TicketType("VIP", 180.0, 20)));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        Event saved = service.createEvent(e);

        assertEquals(80, saved.getTotalSeats(), "capacité = somme des quotas");
        assertEquals(80, saved.getAvailableSeats());
        // Prix affiché « à partir de » : le plus bas des types proposés.
        assertEquals(90.0, saved.getPrice());
    }

    @Test
    void createEvent_ignoresEmptyTicketTypes() {
        Event e = new Event();
        e.setTotalSeats(25);
        e.setPrice(0.0);
        e.setTicketTypes(List.of());
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals(25, service.createEvent(e).getTotalSeats());
    }

    // ═══════════ Modération ═══════════

    @Test
    void updateStatus_movesTheSessionThroughModeration() {
        Event e = new Event(); e.setId("ev-1"); e.setStatus("PENDING");
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(e));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals("APPROVED", service.updateStatus("ev-1", "APPROVED").getStatus());
        assertEquals("REJECTED", service.updateStatus("ev-1", "REJECTED").getStatus());
    }

    @Test
    void updateStatus_failsOnUnknownSession() {
        when(eventRepository.findById("inconnu")).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class, () -> service.updateStatus("inconnu", "APPROVED"));
    }

    @Test
    void getEventsByStatus_isCaseInsensitiveAndSafeOnNull() {
        Event pending = new Event(); pending.setStatus("PENDING");
        Event approved = new Event(); approved.setStatus("APPROVED");
        when(eventRepository.findAll()).thenReturn(List.of(pending, approved));

        assertEquals(1, service.getEventsByStatus("pending").size());
        assertTrue(service.getEventsByStatus(null).isEmpty());
    }

    // ═══════════ Places disponibles ═══════════

    @Test
    void adjustAvailableSeats_decrementsOnRegistrationAndIncrementsOnCancellation() {
        Event e = new Event(); e.setId("ev-1"); e.setTotalSeats(10); e.setAvailableSeats(5);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(e));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals(4, service.adjustAvailableSeats("ev-1", -1).getAvailableSeats());
        assertEquals(5, service.adjustAvailableSeats("ev-1", +1).getAvailableSeats());
    }

    @Test
    void adjustAvailableSeats_clampsBetweenZeroAndCapacity() {
        Event full = new Event(); full.setId("ev-1"); full.setTotalSeats(10); full.setAvailableSeats(0);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(full));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        // Une inscription de trop ne doit jamais produire un nombre négatif…
        assertEquals(0, service.adjustAvailableSeats("ev-1", -1).getAvailableSeats());

        Event empty = new Event(); empty.setId("ev-2"); empty.setTotalSeats(10); empty.setAvailableSeats(10);
        when(eventRepository.findById("ev-2")).thenReturn(Optional.of(empty));
        // …ni une annulation en trop dépasser la capacité.
        assertEquals(10, service.adjustAvailableSeats("ev-2", +1).getAvailableSeats());
    }

    @Test
    void adjustAvailableSeats_treatsMissingAvailabilityAsFullCapacity() {
        // Événement hérité, créé avant le suivi des places.
        Event legacy = new Event(); legacy.setId("ev-1"); legacy.setTotalSeats(10);
        legacy.setAvailableSeats(null);
        when(eventRepository.findById("ev-1")).thenReturn(Optional.of(legacy));
        when(eventRepository.save(any(Event.class))).thenAnswer(i -> i.getArgument(0));

        assertEquals(9, service.adjustAvailableSeats("ev-1", -1).getAvailableSeats());
    }

    // ═══════════ Statistiques ═══════════

    @Test
    void stats_countsByModerationStatusAndSeats() {
        Event a = new Event(); a.setStatus("APPROVED"); a.setTotalSeats(10); a.setAvailableSeats(4); a.setCategory("AWS");
        Event b = new Event(); b.setStatus("PENDING");  b.setTotalSeats(20); b.setAvailableSeats(20); b.setCategory("AWS");
        Event c = new Event(); c.setStatus("REJECTED"); c.setTotalSeats(5);  c.setAvailableSeats(5);
        when(eventRepository.findAll()).thenReturn(List.of(a, b, c));

        Map<String, Object> stats = service.stats();

        assertEquals(3, stats.get("total"));
        assertEquals(1L, stats.get("published"));
        assertEquals(1L, stats.get("pending"));
        assertEquals(1L, stats.get("rejected"));
        assertEquals(35, stats.get("totalSeats"));
        assertEquals(6, stats.get("reservedSeats"));   // 35 - 29

        @SuppressWarnings("unchecked")
        Map<String, Long> byCategory = (Map<String, Long>) stats.get("byCategory");
        assertEquals(2L, byCategory.get("AWS"));
        // Une catégorie absente doit rester visible dans le rapport, pas disparaître.
        assertEquals(1L, byCategory.get("(non défini)"));
    }

    @Test
    void stats_toleratesEventsWithoutSeatInformation() {
        Event incomplete = new Event();   // aucune place renseignée
        when(eventRepository.findAll()).thenReturn(List.of(incomplete));

        Map<String, Object> stats = service.stats();

        assertEquals(0, stats.get("totalSeats"));
        assertEquals(0, stats.get("reservedSeats"));
    }
}
