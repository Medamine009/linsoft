package com.pfe.events.eventservice.services;

import com.pfe.events.eventservice.entities.Event;
import com.pfe.events.eventservice.repositories.EventRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

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
}
