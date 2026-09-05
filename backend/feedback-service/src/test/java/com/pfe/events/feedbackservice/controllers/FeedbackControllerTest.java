package com.pfe.events.feedbackservice.controllers;

import com.pfe.events.feedbackservice.config.JwtAuthConverter;
import com.pfe.events.feedbackservice.config.SecurityConfig;
import com.pfe.events.feedbackservice.entities.Feedback;
import com.pfe.events.feedbackservice.services.FeedbackService;
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

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * API des avis sur les sessions.
 *
 * <p>Les avis alimentent la note moyenne affichée au catalogue et l'analyse de
 * sentiment par l'IA. Le point sensible est la règle « un seul avis par personne
 * et par session » : sans elle, une note pourrait être gonflée par un seul
 * participant.</p>
 */
@WebMvcTest(FeedbackController.class)
@Import({SecurityConfig.class, JwtAuthConverter.class})
class FeedbackControllerTest {

    @Autowired MockMvc mvc;

    @MockBean FeedbackService feedbackService;
    @MockBean JwtDecoder jwtDecoder;

    private RequestPostProcessor participant() {
        return jwt().jwt(j -> j.subject("kc-1"))
                .authorities(new SimpleGrantedAuthority("ROLE_PARTICIPANT"));
    }

    private Feedback feedback(String id, int rating) {
        Feedback f = new Feedback();
        f.setId(id);
        f.setEventId("ev-1");
        f.setUserId("kc-1");
        f.setRating(rating);
        f.setComment("Formation très complète");
        return f;
    }

    private static final String BODY =
            "{\"eventId\":\"ev-1\",\"userId\":\"kc-1\",\"rating\":5,\"comment\":\"Formation très complète\"}";

    // ─────────────── Dépôt d'un avis ───────────────

    @Test
    void createFeedback_storesTheReview() throws Exception {
        when(feedbackService.createFeedback(any(Feedback.class))).thenReturn(feedback("f1", 5));

        mvc.perform(post("/api/feedback").with(participant())
                        .contentType("application/json").content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rating").value(5))
                .andExpect(jsonPath("$.eventId").value("ev-1"));
    }

    @Test
    void createFeedback_rejectsASecondReviewFromTheSamePerson() throws Exception {
        // La règle métier remonte du service ; le contrôleur doit la traduire en
        // 400 plutôt qu'en 500, pour que l'interface affiche un message clair.
        when(feedbackService.createFeedback(any(Feedback.class)))
                .thenThrow(new RuntimeException("User has already submitted feedback for this event."));

        mvc.perform(post("/api/feedback").with(participant())
                        .contentType("application/json").content(BODY))
                .andExpect(status().isBadRequest());
    }

    @Test
    void createFeedback_requiresAuthentication() throws Exception {
        mvc.perform(post("/api/feedback").contentType("application/json").content(BODY))
                .andExpect(status().isUnauthorized());
        verify(feedbackService, never()).createFeedback(any());
    }

    // ─────────────── Consultation ───────────────

    @Test
    void getFeedbacksByEvent_returnsTheReviewsOfThatSession() throws Exception {
        when(feedbackService.getFeedbacksByEvent("ev-1"))
                .thenReturn(List.of(feedback("f1", 5), feedback("f2", 4)));

        mvc.perform(get("/api/feedback/event/ev-1").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void getFeedbacksByEvent_returnsAnEmptyListRatherThanAnError() throws Exception {
        when(feedbackService.getFeedbacksByEvent("ev-vide")).thenReturn(List.of());

        // Une session sans avis est un cas normal, pas une erreur.
        mvc.perform(get("/api/feedback/event/ev-vide").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void getAverageRating_exposesTheScoreShownInTheCatalogue() throws Exception {
        when(feedbackService.getAverageRatingForEvent("ev-1")).thenReturn(4.5);

        mvc.perform(get("/api/feedback/event/ev-1/average").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.averageRating").value(4.5));
    }

    @Test
    void getAverageRating_isZeroWhenNobodyRatedYet() throws Exception {
        when(feedbackService.getAverageRatingForEvent("ev-vide")).thenReturn(0.0);

        mvc.perform(get("/api/feedback/event/ev-vide/average").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.averageRating").value(0.0));
    }

    @Test
    void getFeedbackById_returnsNotFoundWhenAbsent() throws Exception {
        when(feedbackService.getFeedbackById("inconnu")).thenReturn(Optional.empty());

        mvc.perform(get("/api/feedback/inconnu").with(participant()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getFeedbacksByUser_returnsThatPersonHistory() throws Exception {
        when(feedbackService.getFeedbacksByUser("kc-1")).thenReturn(List.of(feedback("f1", 5)));

        mvc.perform(get("/api/feedback/user/kc-1").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].userId").value("kc-1"));
    }

    // ─────────────── Suppression ───────────────

    @Test
    void deleteFeedback_removesTheReview() throws Exception {
        mvc.perform(delete("/api/feedback/f1").with(participant()))
                .andExpect(status().isNoContent());
        verify(feedbackService).deleteFeedback("f1");
    }

    @Test
    void deleteFeedback_requiresAuthentication() throws Exception {
        mvc.perform(delete("/api/feedback/f1"))
                .andExpect(status().isUnauthorized());
        verify(feedbackService, never()).deleteFeedback(anyString());
    }
}
