package com.pfe.events.aiservice.services;

import com.fasterxml.jackson.databind.JsonNode;
import com.pfe.events.aiservice.dto.ChatRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Client de l'API Google Gemini (generativelanguage.googleapis.com).
 * C'est LE moteur derrière notre propre API /api/ai/chat.
 */
@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);

    private final RestClient http = RestClient.create();

    @Value("${gemini.api-key:}")
    private String apiKey;

    @Value("${gemini.model:gemini-2.0-flash}")
    private String model;

    @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta}")
    private String baseUrl;

    public String getModel() { return model; }

    /**
     * Envoie l'instruction système + l'historique + le message courant à Gemini
     * et renvoie la réponse texte. Ne lève jamais : renvoie un message de secours en cas d'erreur.
     */
    public String chat(String systemInstruction, List<ChatRequest.ChatTurn> history, String userMessage) {
        if (apiKey == null || apiKey.isBlank() || apiKey.equalsIgnoreCase("CHANGE_ME")) {
            return "⚙️ L'assistant IA n'est pas encore configuré : ajoutez une clé API Gemini "
                 + "(variable GEMINI_API_KEY). Clé gratuite sur https://aistudio.google.com/apikey";
        }

        // Construction des tours de conversation
        List<Map<String, Object>> contents = new ArrayList<>();
        if (history != null) {
            for (ChatRequest.ChatTurn t : history) {
                if (t == null || t.getContent() == null || t.getContent().isBlank()) continue;
                String role = "assistant".equalsIgnoreCase(t.getRole()) ? "model" : "user";
                contents.add(turn(role, t.getContent()));
            }
        }
        contents.add(turn("user", userMessage));

        Map<String, Object> body = Map.of(
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
            "contents", contents,
            "generationConfig", Map.of(
                "temperature", 0.4,
                "maxOutputTokens", 800,
                "topP", 0.9
            )
        );

        String url = baseUrl + "/models/" + model + ":generateContent?key=" + apiKey;

        try {
            JsonNode resp = http.post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(JsonNode.class);

            String text = extractText(resp);
            if (text != null && !text.isBlank()) return text.trim();

            // Réponse vide : souvent un blocage de sécurité côté Gemini
            String block = resp != null && resp.path("promptFeedback").hasNonNull("blockReason")
                    ? resp.path("promptFeedback").path("blockReason").asText() : null;
            if (block != null) {
                return "Je ne peux pas répondre à cette demande (" + block + "). Reformulez ou contactez un organisateur.";
            }
            return "Désolé, je n'ai pas pu générer de réponse. Réessayez dans un instant.";
        } catch (Exception ex) {
            log.error("[Gemini] appel échoué : {}", ex.getMessage());
            return "L'assistant IA est momentanément indisponible. Réessayez dans quelques instants.";
        }
    }

    private Map<String, Object> turn(String role, String text) {
        return Map.of("role", role, "parts", List.of(Map.of("text", text)));
    }

    private String extractText(JsonNode resp) {
        if (resp == null) return null;
        JsonNode candidates = resp.path("candidates");
        if (!candidates.isArray() || candidates.isEmpty()) return null;
        JsonNode parts = candidates.get(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) return null;
        StringBuilder sb = new StringBuilder();
        for (JsonNode p : parts) {
            if (p.hasNonNull("text")) sb.append(p.get("text").asText());
        }
        return sb.toString();
    }
}
