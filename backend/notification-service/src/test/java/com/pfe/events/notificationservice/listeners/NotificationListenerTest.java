package com.pfe.events.notificationservice.listeners;

import com.pfe.events.notificationservice.entities.InAppMessage;
import com.pfe.events.notificationservice.repositories.InAppMessageRepository;
import com.pfe.events.notificationservice.services.EmailService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Consommation des messages RabbitMQ par le notification-service.
 *
 * <p>Ce composant est le point d'arrivée de tout le flux asynchrone : une
 * inscription confirmée, une session close ou un certificat délivré finissent
 * ici. On vérifie donc qu'il produit le bon message pour chaque type, qu'il
 * dépose bien une copie in-app, et surtout qu'un message malformé ne fait pas
 * tomber le consommateur — sinon la file se bloquerait pour tout le monde.</p>
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationListenerTest {

    @Mock EmailService emailService;
    @Mock InAppMessageRepository messageRepository;
    @InjectMocks NotificationListener listener;

    private String payload(String type, String email) {
        return "{\"type\":\"" + type + "\","
                + "\"email\":" + (email == null ? "null" : "\"" + email + "\"") + ","
                + "\"firstName\":\"Yassine\","
                + "\"eventTitle\":\"Kubernetes Administrator (CKA)\","
                + "\"eventDate\":\"2026-08-17T09:00\","
                + "\"eventLocation\":\"LINSOFT Academy\","
                + "\"registrationId\":\"reg-1\"}";
    }

    /** Capture le sujet transmis à l'email. */
    private String subjectOf(String type) {
        listener.handle(payload(type, "y.gharbi@linsoft.tn"));
        ArgumentCaptor<String> subject = ArgumentCaptor.forClass(String.class);
        verify(emailService, atLeastOnce()).sendHtml(eq("y.gharbi@linsoft.tn"), subject.capture(), anyString());
        return subject.getValue();
    }

    // ─────────────── Acheminement nominal ───────────────

    @Test
    void handle_sendsEmailAndStoresInAppCopy() {
        listener.handle(payload("REGISTRATION_CONFIRMED", "y.gharbi@linsoft.tn"));

        verify(emailService).sendHtml(eq("y.gharbi@linsoft.tn"), anyString(), anyString());

        ArgumentCaptor<InAppMessage> saved = ArgumentCaptor.forClass(InAppMessage.class);
        verify(messageRepository).save(saved.capture());
        assertEquals("y.gharbi@linsoft.tn", saved.getValue().getRecipientEmail());
        assertTrue(saved.getValue().getMessage().contains("Kubernetes Administrator (CKA)"));
        assertFalse(saved.getValue().isRead(), "un message qui arrive est non lu");
    }

    @Test
    void handle_buildsADistinctSubjectPerEventType() {
        assertTrue(subjectOf("REGISTRATION_CONFIRMED").startsWith("Inscription confirmée"));
        reset(emailService);
        assertTrue(subjectOf("REGISTRATION_REQUESTED").startsWith("Demande reçue"));
        reset(emailService);
        assertTrue(subjectOf("EVENT_COMPLETED").startsWith("Session terminée"));
        reset(emailService);
        assertTrue(subjectOf("CERTIFICATE_SENT").startsWith("Votre certificat est disponible"));
    }

    @Test
    void handle_certificateMessagesCarryTheWorkflowState() {
        listener.handle(payload("EVENT_COMPLETED", "y.gharbi@linsoft.tn"));
        ArgumentCaptor<InAppMessage> completed = ArgumentCaptor.forClass(InAppMessage.class);
        verify(messageRepository).save(completed.capture());
        // La cloture doit annoncer la preparation du certificat : c'est ce que le
        // participant lit avant toute action de l'administrateur.
        assertTrue(completed.getValue().getMessage().toLowerCase().contains("préparation"));

        reset(messageRepository);
        listener.handle(payload("CERTIFICATE_SENT", "y.gharbi@linsoft.tn"));
        ArgumentCaptor<InAppMessage> sent = ArgumentCaptor.forClass(InAppMessage.class);
        verify(messageRepository).save(sent.capture());
        assertTrue(sent.getValue().getMessage().toLowerCase().contains("disponible"));
    }

    @Test
    void handle_unknownTypeStillDeliversAGenericNotification() {
        listener.handle(payload("TYPE_INCONNU", "y.gharbi@linsoft.tn"));

        verify(emailService).sendHtml(eq("y.gharbi@linsoft.tn"), anyString(), anyString());
        verify(messageRepository).save(any(InAppMessage.class));
    }

    // ─────────────── Cas dégradés ───────────────

    @Test
    void handle_skipsMessageWithoutRecipient() {
        listener.handle(payload("REGISTRATION_CONFIRMED", null));

        // Sans adresse, il n'y a rien à envoyer ni à ranger dans une boîte.
        verify(emailService, never()).sendHtml(anyString(), anyString(), anyString());
        verify(messageRepository, never()).save(any());
    }

    @Test
    void handle_skipsMessageWithBlankRecipient() {
        listener.handle(payload("REGISTRATION_CONFIRMED", "   "));

        verify(emailService, never()).sendHtml(anyString(), anyString(), anyString());
        verify(messageRepository, never()).save(any());
    }

    @Test
    void handle_malformedPayloadDoesNotPropagate() {
        // Un message illisible ne doit pas remonter en exception : sinon RabbitMQ
        // le redélivre en boucle et bloque la consommation de toute la file.
        assertDoesNotThrow(() -> listener.handle("ceci n'est pas du JSON"));
        verify(emailService, never()).sendHtml(anyString(), anyString(), anyString());
    }

    @Test
    void handle_stillSendsEmailWhenInAppStorageFails() {
        // La panne du stockage in-app ne doit pas priver le destinataire de son email.
        when(messageRepository.save(any(InAppMessage.class)))
                .thenThrow(new RuntimeException("Mongo indisponible"));

        assertDoesNotThrow(() -> listener.handle(payload("REGISTRATION_CONFIRMED", "y.gharbi@linsoft.tn")));
        verify(emailService).sendHtml(eq("y.gharbi@linsoft.tn"), anyString(), anyString());
    }

    @Test
    void handle_toleratesMissingOptionalFields() {
        // event-service publie parfois sans lieu ni date : le gabarit doit tenir.
        String minimal = "{\"type\":\"EVENT_REMINDER\",\"email\":\"y.gharbi@linsoft.tn\"}";

        assertDoesNotThrow(() -> listener.handle(minimal));
        verify(emailService).sendHtml(eq("y.gharbi@linsoft.tn"), anyString(), anyString());
    }
}
