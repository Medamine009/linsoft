package com.pfe.events.registrationservice.services;

import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.repositories.RegistrationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RegistrationServiceTest {

    @Mock RegistrationRepository registrationRepository;
    @Mock NotificationPublisher notificationPublisher;
    @Mock EventSeatUpdater seatUpdater;
    @Mock UserEnrichmentService userEnrichment;
    @Mock EventEnrichmentService eventEnrichment;
    @Mock ParticipationProgressService progress;
    @InjectMocks RegistrationService service;

    @Test
    void registerForEvent_rejectsDoubleRegistration() {
        when(registrationRepository.existsByEventIdAndAttendeeIdAndStatus("e1", "u1", "CONFIRMED"))
                .thenReturn(true);

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> service.registerForEvent("e1", "u1"));
        assertTrue(ex.getMessage().toLowerCase().contains("already"));
        verify(registrationRepository, never()).save(any());
        verify(seatUpdater, never()).decrement(any());
    }

    @Test
    void sendCertificate_refusedWhileSessionNotFinished() {
        Registration reg = new Registration();
        reg.setId("r1");
        reg.setStatus("CONFIRMED");
        reg.setCertificateStatus("NOT_AVAILABLE");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg));

        assertThrows(IllegalStateException.class, () -> service.sendCertificate("r1", "admin"));
        verify(registrationRepository, never()).save(any());
        verify(notificationPublisher, never()).publishCertificateSent(any());
    }

    @Test
    void sendCertificate_deliversPreparedCertificate() {
        Registration reg = new Registration();
        reg.setId("r1");
        reg.setEventId("e1");
        reg.setAttendeeId("u1");
        reg.setStatus("CONFIRMED");
        reg.setCertificateStatus("IN_PREPARATION");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg));
        when(registrationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Registration sent = service.sendCertificate("r1", "Amine (admin)");

        assertEquals("SENT", sent.getCertificateStatus());
        assertNotNull(sent.getCertificateSentAt());
        assertEquals("Amine (admin)", sent.getCertificateHandledBy());
        assertTrue(service.isCertificateDownloadable(sent));
        verify(notificationPublisher).publishCertificateSent(sent);
    }

    @Test
    void holdCertificate_keepsItInTheAdminQueue() {
        Registration reg = new Registration();
        reg.setId("r1");
        reg.setStatus("CONFIRMED");
        reg.setCertificateStatus("IN_PREPARATION");
        when(registrationRepository.findById("r1")).thenReturn(Optional.of(reg));
        when(registrationRepository.save(any())).thenAnswer(i -> i.getArgument(0));

        Registration held = service.holdCertificate("r1", "admin");

        assertEquals("PENDING_APPROVAL", held.getCertificateStatus());
        assertFalse(service.isCertificateDownloadable(held));
        verify(notificationPublisher, never()).publishCertificateSent(any());
    }
}
