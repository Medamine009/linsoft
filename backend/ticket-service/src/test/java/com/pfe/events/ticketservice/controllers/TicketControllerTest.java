package com.pfe.events.ticketservice.controllers;

import com.pfe.events.ticketservice.config.JwtAuthConverter;
import com.pfe.events.ticketservice.config.SecurityConfig;
import com.pfe.events.ticketservice.entities.Ticket;
import com.pfe.events.ticketservice.services.QrCodeService;
import com.pfe.events.ticketservice.services.TicketService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
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
 * API des billets et du QR code.
 *
 * <p>Le QR est délibérément **public** : il est demandé par la balise image de
 * la page billet, avant toute négociation de jeton, et par un lecteur de
 * téléphone à l'entrée. Le reste de l'API, qui expose des données nominatives,
 * reste fermé. Ces tests verrouillent précisément cette frontière.</p>
 */
@WebMvcTest(TicketController.class)
@Import({SecurityConfig.class, JwtAuthConverter.class})
class TicketControllerTest {

    @Autowired MockMvc mvc;

    @MockBean TicketService ticketService;
    @MockBean QrCodeService qrCodeService;
    @MockBean JwtDecoder jwtDecoder;

    private RequestPostProcessor participant() {
        return jwt().jwt(j -> j.subject("kc-1"))
                .authorities(new SimpleGrantedAuthority("ROLE_PARTICIPANT"));
    }

    private Ticket ticket(String id, String status) {
        Ticket t = new Ticket();
        t.setId(id);
        t.setRegistrationId("reg-1");
        t.setEventId("ev-1");
        t.setAttendeeId("kc-1");
        t.setQrCode("QR-abc");
        t.setStatus(status);
        return t;
    }

    // ─────────────── QR code : volontairement public ───────────────

    @Test
    void qrCode_isServedWithoutAuthentication() throws Exception {
        when(qrCodeService.generatePng(anyString(), anyInt())).thenReturn(new byte[]{(byte) 0x89, 'P', 'N', 'G'});

        // Variante « contenu dans le chemin ».
        mvc.perform(get("/api/tickets/qr/LINSOFT-TICKET-abc"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));

        // Variante « contenu en paramètre » — utilisée pour encoder une URL
        // complète, dont les `/` et `:` casseraient un segment de chemin.
        mvc.perform(get("/api/tickets/qr").param("content", "http://localhost:4200/ticket/abc"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG));
    }

    @Test
    void qrCode_isCacheableToAvoidRegeneratingOnEveryDisplay() throws Exception {
        when(qrCodeService.generatePng(anyString(), anyInt())).thenReturn(new byte[]{(byte) 0x89, 'P', 'N', 'G'});

        mvc.perform(get("/api/tickets/qr").param("content", "abc"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "public, max-age=3600"));
    }

    @Test
    void qrCode_honoursTheRequestedSize() throws Exception {
        when(qrCodeService.generatePng(anyString(), anyInt())).thenReturn(new byte[]{(byte) 0x89, 'P', 'N', 'G'});

        mvc.perform(get("/api/tickets/qr").param("content", "abc").param("size", "480"))
                .andExpect(status().isOk());
        verify(qrCodeService).generatePng("abc", 480);

        // Taille par défaut lorsqu'elle n'est pas précisée.
        mvc.perform(get("/api/tickets/qr").param("content", "abc")).andExpect(status().isOk());
        verify(qrCodeService).generatePng("abc", 240);
    }

    @Test
    void qrCode_returnsServerErrorRatherThanACorruptImage() throws Exception {
        when(qrCodeService.generatePng(anyString(), anyInt()))
                .thenThrow(new IllegalArgumentException("contenu vide"));

        // Mieux vaut un 500 explicite qu'un corps vide servi en image/png,
        // qu'aucun lecteur ne saurait interpréter.
        mvc.perform(get("/api/tickets/qr").param("content", "x"))
                .andExpect(status().isInternalServerError());
    }

    // ─────────────── Reste de l'API : fermé ───────────────

    @Test
    void ticketDataRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/tickets/t1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tickets/event/ev-1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/tickets/attendee/kc-1")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/tickets/t1/validate")).andExpect(status().isUnauthorized());
    }

    @Test
    void createTicket_returnsTheCreatedResource() throws Exception {
        when(ticketService.createTicket("reg-1", "ev-1", "kc-1")).thenReturn(ticket("t1", "VALID"));

        mvc.perform(post("/api/tickets").with(participant())
                        .param("registrationId", "reg-1")
                        .param("eventId", "ev-1")
                        .param("attendeeId", "kc-1"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.qrCode").value("QR-abc"));
    }

    @Test
    void getTicketById_returnsNotFoundWhenAbsent() throws Exception {
        when(ticketService.getTicketById("inconnu")).thenReturn(Optional.empty());

        mvc.perform(get("/api/tickets/inconnu").with(participant()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getTicketByRegistration_resolvesTheTicketOfARegistration() throws Exception {
        when(ticketService.getTicketByRegistration("reg-1")).thenReturn(Optional.of(ticket("t1", "VALID")));

        mvc.perform(get("/api/tickets/registration/reg-1").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.registrationId").value("reg-1"));
    }

    @Test
    void getTicketsByEvent_andByAttendee_returnLists() throws Exception {
        when(ticketService.getTicketsByEvent("ev-1")).thenReturn(List.of(ticket("t1", "VALID"), ticket("t2", "USED")));
        when(ticketService.getTicketsByAttendee("kc-1")).thenReturn(List.of(ticket("t1", "VALID")));

        mvc.perform(get("/api/tickets/event/ev-1").with(participant()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        mvc.perform(get("/api/tickets/attendee/kc-1").with(participant()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    // ─────────────── Validation à l'entrée ───────────────

    @Test
    void validateTicket_marksItUsed() throws Exception {
        when(ticketService.validateTicket("t1")).thenReturn(ticket("t1", "USED"));

        mvc.perform(put("/api/tickets/t1/validate").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("USED"));
    }

    @Test
    void validateTicket_refusesAnAlreadyUsedTicketWithBadRequest() throws Exception {
        when(ticketService.validateTicket("t1")).thenThrow(new RuntimeException("Ticket already used or cancelled"));

        // 400 et non 500 : l'agent d'accueil doit voir un refus métier,
        // pas une panne technique.
        mvc.perform(put("/api/tickets/t1/validate").with(participant()))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cancelTicket_returnsNotFoundWhenAbsent() throws Exception {
        when(ticketService.cancelTicket("inconnu")).thenThrow(new RuntimeException("Ticket not found: inconnu"));

        mvc.perform(put("/api/tickets/inconnu/cancel").with(participant()))
                .andExpect(status().isNotFound());
    }

    @Test
    void cancelTicket_marksItCancelled() throws Exception {
        when(ticketService.cancelTicket("t1")).thenReturn(ticket("t1", "CANCELLED"));

        mvc.perform(put("/api/tickets/t1/cancel").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }
}
