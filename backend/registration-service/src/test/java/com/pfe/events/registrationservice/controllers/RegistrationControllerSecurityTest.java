package com.pfe.events.registrationservice.controllers;

import com.pfe.events.registrationservice.config.JwtAuthConverter;
import com.pfe.events.registrationservice.config.SecurityConfig;
import com.pfe.events.registrationservice.entities.Registration;
import com.pfe.events.registrationservice.services.CertificateService;
import com.pfe.events.registrationservice.services.ParticipationProgressService;
import com.pfe.events.registrationservice.services.RegistrationService;
import org.junit.jupiter.api.BeforeEach;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Contrôle d'accès réel de l'API d'inscription.
 *
 * <p>La configuration de sécurité de production est chargée telle quelle
 * ({@code @Import(SecurityConfig.class)}) : ces tests vérifient les règles qui
 * s'appliqueront en production, et non une sécurité désactivée pour les besoins
 * du test. Chaque appel porte un jeton simulé avec ses rôles Keycloak.</p>
 */
@WebMvcTest(RegistrationController.class)
@Import({SecurityConfig.class, JwtAuthConverter.class})
class RegistrationControllerSecurityTest {

    @Autowired MockMvc mvc;

    @MockBean RegistrationService registrationService;
    @MockBean CertificateService certificateService;
    @MockBean ParticipationProgressService progressService;
    // Requis par oauth2ResourceServer : sans décodeur, le contexte ne démarre pas.
    @MockBean JwtDecoder jwtDecoder;

    private static final String PARTICIPANT_ID = "kc-participant";
    private static final String OTHER_ID = "kc-autre";

    /** Jeton d'un participant (rôle Keycloak PARTICIPANT), identifié par son `sub`. */
    private RequestPostProcessor participant(String subject) {
        return jwt().jwt(j -> j.subject(subject).claim("email", "y.gharbi@linsoft.tn"))
                .authorities(new SimpleGrantedAuthority("ROLE_PARTICIPANT"));
    }

    private RequestPostProcessor admin() {
        return jwt().jwt(j -> j.subject("kc-admin").claim("name", "Sonia Ben Amor"))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private RequestPostProcessor organisateur() {
        return jwt().jwt(j -> j.subject("kc-orga"))
                .authorities(new SimpleGrantedAuthority("ROLE_ORGANISATEUR"));
    }

    private Registration registration(String id, String attendeeId, String certificateStatus) {
        Registration r = new Registration();
        r.setId(id);
        r.setEventId("ev-1");
        r.setAttendeeId(attendeeId);
        r.setStatus("CONFIRMED");
        r.setCertificateStatus(certificateStatus);
        r.setAttendeeName("Yassine Gharbi");
        r.setEventTitle("Kubernetes Administrator (CKA)");
        return r;
    }

    @BeforeEach
    void stubCertificate() {
        when(certificateService.generate(any(Registration.class))).thenReturn("%PDF-1.4 fake".getBytes());
    }

    // ═══════════ Authentification ═══════════

    @Test
    void anonymousCallerIsRejected() throws Exception {
        mvc.perform(get("/api/registrations")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/registrations/certificates/pending")).andExpect(status().isUnauthorized());
    }

    @Test
    void publicVerifyEndpointStaysOpenWithoutToken() throws Exception {
        // Page de vérification d'un billet scanné : elle doit rester accessible
        // sans compte, c'est tout son intérêt.
        when(registrationService.getRegistrationById("reg-1"))
                .thenReturn(Optional.of(registration("reg-1", PARTICIPANT_ID, "SENT")));

        mvc.perform(get("/api/registrations/reg-1/verify"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.eventTitle").value("Kubernetes Administrator (CKA)"));
    }

    @Test
    void verifyReturnsNotFoundForUnknownTicket() throws Exception {
        when(registrationService.getRegistrationById("inconnu")).thenReturn(Optional.empty());

        mvc.perform(get("/api/registrations/inconnu/verify"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.valid").value(false));
    }

    // ═══════════ Autorisation par rôle ═══════════

    @Test
    void certificateQueueIsReservedToAdmin() throws Exception {
        when(registrationService.getPendingCertificates()).thenReturn(List.of());

        mvc.perform(get("/api/registrations/certificates/pending").with(admin()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/registrations/certificates/pending").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isForbidden());
        // Le formateur valide les inscriptions mais ne délivre pas les certificats.
        mvc.perform(get("/api/registrations/certificates/pending").with(organisateur()))
                .andExpect(status().isForbidden());
    }

    @Test
    void sendingACertificateIsReservedToAdmin() throws Exception {
        when(registrationService.sendCertificate(anyString(), anyString()))
                .thenReturn(registration("reg-1", PARTICIPANT_ID, "SENT"));

        mvc.perform(put("/api/registrations/reg-1/certificate/send").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.certificateStatus").value("SENT"));

        mvc.perform(put("/api/registrations/reg-1/certificate/send").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isForbidden());
        verify(registrationService, times(1)).sendCertificate(anyString(), anyString());
    }

    @Test
    void holdingACertificateIsReservedToAdmin() throws Exception {
        when(registrationService.holdCertificate(anyString(), anyString()))
                .thenReturn(registration("reg-1", PARTICIPANT_ID, "PENDING_APPROVAL"));

        mvc.perform(put("/api/registrations/reg-1/certificate/hold").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.certificateStatus").value("PENDING_APPROVAL"));
        mvc.perform(put("/api/registrations/reg-1/certificate/hold").with(organisateur()))
                .andExpect(status().isForbidden());
    }

    @Test
    void registrationValidationIsOpenToOrganiserAndAdminOnly() throws Exception {
        when(registrationService.getPending()).thenReturn(List.of());

        mvc.perform(get("/api/registrations/pending").with(admin())).andExpect(status().isOk());
        mvc.perform(get("/api/registrations/pending").with(organisateur())).andExpect(status().isOk());
        mvc.perform(get("/api/registrations/pending").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isForbidden());
    }

    @Test
    void checkInIsClosedToParticipants() throws Exception {
        mvc.perform(put("/api/registrations/reg-1/checkin").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isForbidden());
        verify(registrationService, never()).checkIn(anyString());
    }

    // ═══════════ Téléchargement du certificat ═══════════

    @Test
    void participantDownloadsOwnCertificateOnceSent() throws Exception {
        Registration reg = registration("reg-1", PARTICIPANT_ID, "SENT");
        when(registrationService.getRegistrationById("reg-1")).thenReturn(Optional.of(reg));
        when(registrationService.isCertificateDownloadable(reg)).thenReturn(true);

        mvc.perform(get("/api/registrations/reg-1/certificate").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void participantCannotDownloadCertificateStillBeingPrepared() throws Exception {
        Registration reg = registration("reg-1", PARTICIPANT_ID, "IN_PREPARATION");
        when(registrationService.getRegistrationById("reg-1")).thenReturn(Optional.of(reg));
        when(registrationService.isCertificateDownloadable(reg)).thenReturn(false);

        // 409 et non 403 : le droit existe, c'est l'état du dossier qui bloque.
        mvc.perform(get("/api/registrations/reg-1/certificate").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isConflict());
        verify(certificateService, never()).generate(any());
    }

    @Test
    void participantCannotDownloadSomeoneElsesCertificate() throws Exception {
        Registration reg = registration("reg-1", OTHER_ID, "SENT");
        when(registrationService.getRegistrationById("reg-1")).thenReturn(Optional.of(reg));

        mvc.perform(get("/api/registrations/reg-1/certificate").with(participant(PARTICIPANT_ID)))
                .andExpect(status().isForbidden());
        verify(certificateService, never()).generate(any());
    }

    @Test
    void adminMayDownloadAnyCertificateEvenBeforeSending() throws Exception {
        // L'administration doit pouvoir contrôler la pièce avant de la délivrer.
        Registration reg = registration("reg-1", OTHER_ID, "IN_PREPARATION");
        when(registrationService.getRegistrationById("reg-1")).thenReturn(Optional.of(reg));

        mvc.perform(get("/api/registrations/reg-1/certificate").with(admin()))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF));
    }

    @Test
    void certificateOfCancelledRegistrationIsRefused() throws Exception {
        Registration reg = registration("reg-1", PARTICIPANT_ID, "NOT_AVAILABLE");
        reg.setStatus("CANCELLED");
        when(registrationService.getRegistrationById("reg-1")).thenReturn(Optional.of(reg));

        mvc.perform(get("/api/registrations/reg-1/certificate").with(admin()))
                .andExpect(status().isConflict());
    }

    @Test
    void certificateOfUnknownRegistrationReturnsNotFound() throws Exception {
        when(registrationService.getRegistrationById("inconnu")).thenReturn(Optional.empty());

        mvc.perform(get("/api/registrations/inconnu/certificate").with(admin()))
                .andExpect(status().isNotFound());
    }

    // ═══════════ Suivi de participation ═══════════

    @Test
    void trackingExposesProgressAndCertificateState() throws Exception {
        Registration reg = registration("reg-1", PARTICIPANT_ID, "IN_PREPARATION");
        reg.setProgressStatus("COMPLETED");
        reg.setProgressPercent(100);
        when(registrationService.getRegistrationsByAttendeeId(PARTICIPANT_ID)).thenReturn(List.of(reg));
        when(progressService.steps(reg)).thenReturn(List.of());
        when(progressService.end(reg)).thenReturn(null);

        mvc.perform(get("/api/registrations/attendee/" + PARTICIPANT_ID + "/tracking")
                        .with(participant(PARTICIPANT_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].progressStatus").value("COMPLETED"))
                .andExpect(jsonPath("$[0].progressPercent").value(100))
                .andExpect(jsonPath("$[0].certificateStatus").value("IN_PREPARATION"))
                .andExpect(jsonPath("$[0].certificateDownloadable").value(false))
                .andExpect(jsonPath("$[0].steps").isArray());
    }

    @Test
    void trackingRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/registrations/attendee/" + PARTICIPANT_ID + "/tracking"))
                .andExpect(status().isUnauthorized());
    }
}
