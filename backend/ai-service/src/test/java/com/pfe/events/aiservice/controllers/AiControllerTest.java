package com.pfe.events.aiservice.controllers;

import com.pfe.events.aiservice.config.JwtAuthConverter;
import com.pfe.events.aiservice.config.SecurityConfig;
import com.pfe.events.aiservice.services.CatalogService;
import com.pfe.events.aiservice.services.FeedbackClient;
import com.pfe.events.aiservice.services.GeminiService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * API de l'assistant IA.
 *
 * <p>Deux choses comptent ici : la validation des entrées (une requête vide ne
 * doit pas partir chez Gemini et consommer du quota) et le fait que le chat
 * reste réservé aux utilisateurs connectés, seul le ping restant public.</p>
 */
@WebMvcTest(AiController.class)
@Import({SecurityConfig.class, JwtAuthConverter.class})
class AiControllerTest {

    @Autowired MockMvc mvc;

    @MockBean GeminiService gemini;
    @MockBean CatalogService catalog;
    @MockBean FeedbackClient feedbackClient;
    @MockBean JwtDecoder jwtDecoder;

    private RequestPostProcessor participant() {
        return jwt().jwt(j -> j.subject("kc-1"))
                .authorities(new SimpleGrantedAuthority("ROLE_PARTICIPANT"));
    }

    @BeforeEach
    void stubDefaults() {
        when(gemini.getModel()).thenReturn("gemini-2.5-flash");
        when(catalog.publishedSummary(any())).thenReturn("Kubernetes Administrator (CKA) — 12/09");
        when(gemini.chat(anyString(), any(), anyString())).thenReturn("Réponse de l'assistant.");
    }

    // ─────────────── Ping public ───────────────

    @Test
    void ping_isReachableWithoutAuthentication() throws Exception {
        // Sonde de disponibilité : elle doit rester ouverte.
        mvc.perform(get("/api/ai/ping"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("ai-service"))
                .andExpect(jsonPath("$.model").value("gemini-2.5-flash"));
    }

    // ─────────────── Chat ───────────────

    @Test
    void chat_requiresAuthentication() throws Exception {
        mvc.perform(post("/api/ai/chat")
                        .contentType("application/json")
                        .content("{\"message\":\"Bonjour\"}"))
                .andExpect(status().isUnauthorized());
        verify(gemini, never()).chat(anyString(), any(), anyString());
    }

    @Test
    void chat_answersAnAuthenticatedParticipant() throws Exception {
        mvc.perform(post("/api/ai/chat").with(participant())
                        .contentType("application/json")
                        .content("{\"message\":\"Quelles formations Kubernetes ?\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value("Réponse de l'assistant."))
                .andExpect(jsonPath("$.model").value("gemini-2.5-flash"));
    }

    @Test
    void chat_rejectsAnEmptyMessageWithoutCallingTheModel() throws Exception {
        // Éviter un aller-retour (et du quota) pour une requête vide.
        mvc.perform(post("/api/ai/chat").with(participant())
                        .contentType("application/json")
                        .content("{\"message\":\"\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/ai/chat").with(participant())
                        .contentType("application/json")
                        .content("{\"message\":\"   \"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(post("/api/ai/chat").with(participant())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest());

        verify(gemini, never()).chat(anyString(), any(), anyString());
    }

    @Test
    void chat_groundsTheAnswerOnTheRealCatalogue() throws Exception {
        mvc.perform(post("/api/ai/chat").with(participant())
                        .contentType("application/json")
                        .content("{\"message\":\"Une formation Kubernetes ?\"}"))
                .andExpect(status().isOk());

        // Le catalogue réel est injecté dans l'instruction système : c'est ce qui
        // empêche l'assistant d'inventer des sessions inexistantes.
        verify(gemini).chat(contains("Kubernetes Administrator (CKA)"), any(), anyString());
    }

    // ─────────────── Analyse des avis ───────────────

    @Test
    void feedbackAnalysis_requiresAnEventId() throws Exception {
        mvc.perform(post("/api/ai/feedback-analysis").with(participant())
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("eventId requis"));

        mvc.perform(post("/api/ai/feedback-analysis").with(participant())
                        .contentType("application/json")
                        .content("{\"eventId\":\"  \"}"))
                .andExpect(status().isBadRequest());

        verify(feedbackClient, never()).fetch(anyString());
    }

    @Test
    void feedbackAnalysis_saysSoWhenThereIsNothingToAnalyse() throws Exception {
        when(feedbackClient.fetch("ev-1")).thenReturn(new FeedbackClient.Result(0, ""));

        mvc.perform(post("/api/ai/feedback-analysis").with(participant())
                        .contentType("application/json")
                        .content("{\"eventId\":\"ev-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(0))
                .andExpect(jsonPath("$.analysis").value(org.hamcrest.Matchers.containsString("Aucun avis")));

        // Aucun appel au modèle : il n'y a rien à résumer.
        verify(gemini, never()).chat(anyString(), any(), anyString());
    }

    @Test
    void feedbackAnalysis_summarisesTheCollectedReviews() throws Exception {
        when(feedbackClient.fetch("ev-1"))
                .thenReturn(new FeedbackClient.Result(3, "- Note 5/5 : très complet\n- Note 4/5 : bon rythme"));
        when(gemini.chat(anyString(), any(), anyString())).thenReturn("**Sentiment global** : positif");

        mvc.perform(post("/api/ai/feedback-analysis").with(participant())
                        .contentType("application/json")
                        .content("{\"eventId\":\"ev-1\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(3))
                .andExpect(jsonPath("$.analysis").value(org.hamcrest.Matchers.containsString("Sentiment global")));

        // Les avis réels sont transmis au modèle, pas seulement leur nombre.
        verify(gemini).chat(anyString(), isNull(), contains("très complet"));
    }

    @Test
    void feedbackAnalysis_requiresAuthentication() throws Exception {
        mvc.perform(post("/api/ai/feedback-analysis")
                        .contentType("application/json")
                        .content("{\"eventId\":\"ev-1\"}"))
                .andExpect(status().isUnauthorized());
    }
}
