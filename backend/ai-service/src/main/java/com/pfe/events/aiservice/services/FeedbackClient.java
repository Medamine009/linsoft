package com.pfe.events.aiservice.services;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Récupère les feedbacks d'un événement auprès du feedback-service
 * (endpoint public /api/feedback/event/{id}) pour l'analyse de sentiment par l'IA.
 */
@Service
public class FeedbackClient {

    private final RestClient http = RestClient.create();

    @Value("${app.feedback.url:http://localhost:8086}")
    private String feedbackBaseUrl;

    /** Nombre de feedbacks et texte compact (note + commentaire), ou vide si aucun. */
    public Result fetch(String eventId) {
        try {
            JsonNode arr = http.get()
                    .uri(feedbackBaseUrl + "/api/feedback/event/" + eventId)
                    .retrieve()
                    .body(JsonNode.class);

            if (arr == null || !arr.isArray() || arr.isEmpty()) return new Result(0, "");

            StringBuilder sb = new StringBuilder();
            int n = 0;
            for (JsonNode f : arr) {
                int rating = f.path("rating").asInt(0);
                String comment = f.path("comment").asText("");
                sb.append("- Note ").append(rating).append("/5");
                if (!comment.isBlank()) sb.append(" : ").append(comment);
                sb.append("\n");
                n++;
            }
            return new Result(n, sb.toString().trim());
        } catch (Exception e) {
            return new Result(0, "");
        }
    }

    public static class Result {
        public final int count;
        public final String text;
        public Result(int count, String text) { this.count = count; this.text = text; }
    }
}
