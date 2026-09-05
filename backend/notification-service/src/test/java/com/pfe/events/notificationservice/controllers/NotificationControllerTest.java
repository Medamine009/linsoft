package com.pfe.events.notificationservice.controllers;

import com.pfe.events.notificationservice.config.JwtAuthConverter;
import com.pfe.events.notificationservice.config.SecurityConfig;
import com.pfe.events.notificationservice.entities.InAppMessage;
import com.pfe.events.notificationservice.repositories.InAppMessageRepository;
import com.pfe.events.notificationservice.services.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * API de diffusion et boîte de réception in-app.
 *
 * <p>Deux exigences fortes ici : la diffusion est réservée à l'administration,
 * et un destinataire ne doit jamais voir — ni marquer comme lu — le message
 * d'un autre. Le cloisonnement repose sur l'adresse portée par le jeton.</p>
 */
@WebMvcTest(NotificationController.class)
@Import({SecurityConfig.class, JwtAuthConverter.class})
class NotificationControllerTest {

    @Autowired MockMvc mvc;

    @MockBean EmailService emailService;
    @MockBean InAppMessageRepository messageRepository;
    @MockBean JwtDecoder jwtDecoder;

    private RequestPostProcessor admin() {
        return jwt().jwt(j -> j.subject("kc-admin").claim("email", "s.benamor@linsoft.tn"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private RequestPostProcessor participant() {
        return jwt().jwt(j -> j.subject("kc-1").claim("email", "y.gharbi@linsoft.tn"))
                .authorities(new SimpleGrantedAuthority("ROLE_PARTICIPANT"));
    }

    private InAppMessage message(String id, String recipient) {
        InAppMessage m = new InAppMessage(recipient, "Objet", "Corps", "ADMIN");
        m.setId(id);
        return m;
    }

    private static final String BODY =
            "{\"subject\":\"Rappel\",\"message\":\"La session débute demain.\","
            + "\"recipients\":[\"a@linsoft.tn\",\"b@linsoft.tn\"]}";

    // ─────────────── Diffusion : réservée à l'administration ───────────────

    @Test
    void broadcast_isReservedToAdmin() throws Exception {
        when(emailService.sendHtml(anyString(), anyString(), anyString())).thenReturn(true);

        mvc.perform(post("/api/notifications/broadcast").with(admin())
                        .contentType("application/json").content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(2));

        mvc.perform(post("/api/notifications/broadcast").with(participant())
                        .contentType("application/json").content(BODY))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/notifications/broadcast")
                        .contentType("application/json").content(BODY))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void broadcast_rejectsIncompleteRequestsWithAReadableMessage() throws Exception {
        for (String bad : new String[]{
                "{\"message\":\"corps\",\"recipients\":[\"a@linsoft.tn\"]}",          // objet manquant
                "{\"subject\":\"Objet\",\"recipients\":[\"a@linsoft.tn\"]}",           // corps manquant
                "{\"subject\":\"Objet\",\"message\":\"corps\",\"recipients\":[]}"      // aucun destinataire
        }) {
            mvc.perform(post("/api/notifications/broadcast").with(admin())
                            .contentType("application/json").content(bad))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").exists());
        }
        verify(emailService, never()).sendHtml(anyString(), anyString(), anyString());
    }

    @Test
    void broadcast_deduplicatesRecipientsIgnoringCase() throws Exception {
        when(emailService.sendHtml(anyString(), anyString(), anyString())).thenReturn(true);
        String body = "{\"subject\":\"O\",\"message\":\"M\",\"recipients\":"
                + "[\"a@linsoft.tn\",\"A@LINSOFT.TN\",\" a@linsoft.tn \",\"b@linsoft.tn\"]}";

        mvc.perform(post("/api/notifications/broadcast").with(admin())
                        .contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(2));

        // Personne ne doit recevoir le même message deux fois.
        verify(emailService, times(2)).sendHtml(anyString(), anyString(), anyString());
    }

    @Test
    void broadcast_separatesInvalidAddressesFromRealFailures() throws Exception {
        when(emailService.sendHtml(anyString(), anyString(), anyString())).thenReturn(true);
        String body = "{\"subject\":\"O\",\"message\":\"M\",\"recipients\":"
                + "[\"a@linsoft.tn\",\"pas-une-adresse\",\"b@\"]}";

        mvc.perform(post("/api/notifications/broadcast").with(admin())
                        .contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(1))
                .andExpect(jsonPath("$.invalidRecipients.length()").value(2));
    }

    @Test
    void broadcast_stillDeliversInAppWhenTheMailServerFails() throws Exception {
        // SMTP indisponible : le message doit tout de même arriver dans la boîte
        // in-app, et la réponse doit distinguer l'échec d'envoi.
        when(emailService.sendHtml(anyString(), anyString(), anyString())).thenReturn(false);

        mvc.perform(post("/api/notifications/broadcast").with(admin())
                        .contentType("application/json").content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sent").value(0))
                .andExpect(jsonPath("$.failed").value(2))
                .andExpect(jsonPath("$.delivered").value(2));

        verify(messageRepository, times(2)).save(any(InAppMessage.class));
    }

    // ─────────────── Boîte de réception : cloisonnée ───────────────

    @Test
    void inbox_returnsOnlyTheCallerMessages() throws Exception {
        when(messageRepository.findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc("y.gharbi@linsoft.tn"))
                .thenReturn(List.of(message("m1", "y.gharbi@linsoft.tn")));

        mvc.perform(get("/api/notifications/inbox").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].recipientEmail").value("y.gharbi@linsoft.tn"));

        // La requête est faite sur l'adresse du jeton, jamais sur un paramètre
        // fourni par le client : c'est ce qui rend le cloisonnement infalsifiable.
        verify(messageRepository).findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc("y.gharbi@linsoft.tn");
    }

    @Test
    void inbox_requiresAuthentication() throws Exception {
        mvc.perform(get("/api/notifications/inbox")).andExpect(status().isUnauthorized());
    }

    @Test
    void markRead_acceptsOnlyTheOwnerOfTheMessage() throws Exception {
        when(messageRepository.findById("m1")).thenReturn(Optional.of(message("m1", "y.gharbi@linsoft.tn")));

        mvc.perform(put("/api/notifications/inbox/m1/read").with(participant()))
                .andExpect(status().isOk());
        verify(messageRepository).save(any(InAppMessage.class));

        reset(messageRepository);
        when(messageRepository.findById("m1")).thenReturn(Optional.of(message("m1", "quelquun.dautre@linsoft.tn")));

        // Marquer le message d'autrui comme lu doit être refusé.
        mvc.perform(put("/api/notifications/inbox/m1/read").with(participant()))
                .andExpect(status().isForbidden());
        verify(messageRepository, never()).save(any(InAppMessage.class));
    }

    @Test
    void markRead_returnsNotFoundForAnUnknownMessage() throws Exception {
        when(messageRepository.findById("inconnu")).thenReturn(Optional.empty());

        mvc.perform(put("/api/notifications/inbox/inconnu/read").with(participant()))
                .andExpect(status().isNotFound());
    }
}
