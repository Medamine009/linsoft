package com.pfe.events.aiservice.services;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

/**
 * Récupère (best-effort) le catalogue des formations publiées auprès de
 * l'event-service, pour que le chatbot puisse répondre sur des sessions réelles.
 * En cas d'échec (service indispo, endpoint sécurisé sans token…), on renvoie
 * une chaîne vide : le chatbot fonctionne quand même en mode « connaissances générales ».
 */
@Service
public class CatalogService {

    private final RestClient http = RestClient.create();

    @Value("${app.catalog.url:http://localhost:8082}")
    private String catalogBaseUrl;

    /** Retourne un résumé texte compact du catalogue, ou "" si indisponible. */
    public String publishedSummary(String bearerToken) {
        try {
            JsonNode events = http.get()
                    .uri(catalogBaseUrl + "/api/events/published")
                    .headers(h -> { if (bearerToken != null) h.setBearerAuth(bearerToken); })
                    .retrieve()
                    .body(JsonNode.class);

            if (events == null || !events.isArray() || events.isEmpty()) {
                return "";
            }

            StringBuilder sb = new StringBuilder();
            int max = Math.min(events.size(), 30);
            for (int i = 0; i < max; i++) {
                JsonNode e = events.get(i);
                sb.append("- ").append(text(e, "title"));
                String cat = text(e, "category");
                if (!cat.isBlank()) sb.append(" [").append(cat).append("]");
                String type = text(e, "type");
                String mode = text(e, "mode");
                if (!type.isBlank() || !mode.isBlank()) {
                    sb.append(" (").append(type.isBlank() ? "" : type)
                      .append(!type.isBlank() && !mode.isBlank() ? " / " : "")
                      .append(mode.isBlank() ? "" : mode).append(")");
                }
                String level = text(e, "level");
                if (!level.isBlank()) sb.append(", niveau ").append(level);
                String date = text(e, "eventDate");
                if (!date.isBlank()) sb.append(" — ").append(date.replace("T", " à "));
                String loc = text(e, "location");
                if (!loc.isBlank()) sb.append(" @ ").append(loc);
                JsonNode seats = e.get("availableSeats");
                if (seats != null && seats.isInt()) sb.append(" — ").append(seats.asInt()).append(" place(s) dispo");
                sb.append("\n");
            }
            return sb.toString().trim();
        } catch (Exception ex) {
            return ""; // best-effort : on n'interrompt jamais le chat
        }
    }

    private String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return (v == null || v.isNull()) ? "" : v.asText("");
    }
}
