package com.pfe.events.eventservice.services;

import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Prévient les inscrits d'une session lorsqu'une modification ou une annulation
 * vient d'être approuvée.
 *
 * <p>event-service ne connaît pas les inscrits : il demande la liste des adresses
 * à registration-service, puis confie la diffusion (email + message in-app) au
 * notification-service, qui sait déjà le faire pour les communications de l'admin.
 * Le jeton de l'administrateur qui vient de trancher est propagé aux deux appels.</p>
 */
@Service
public class ParticipantNotifier {

    private final DiscoveryClient discoveryClient;
    private final RestTemplate rest = new RestTemplate();

    public ParticipantNotifier(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public void notifyParticipants(String eventId, String subject, String message) {
        List<String> recipients = recipientsOf(eventId);
        if (recipients == null || recipients.isEmpty()) {
            System.out.println("[Notify] aucun inscrit à prévenir pour l'événement " + eventId);
            return;
        }
        broadcast(recipients, subject, message);
    }

    /** Adresses des inscrits (hors inscriptions annulées), fournies par registration-service. */
    @SuppressWarnings("unchecked")
    private List<String> recipientsOf(String eventId) {
        try {
            String base = uriOf("registration-service");
            if (base == null) return List.of();
            ResponseEntity<List> resp = rest.exchange(
                    base + "/api/registrations/event/" + eventId + "/emails",
                    HttpMethod.GET, new HttpEntity<>(authHeaders()), List.class);
            return resp.getBody() == null ? List.of() : (List<String>) resp.getBody();
        } catch (Exception e) {
            System.err.println("[Notify] liste des inscrits indisponible pour " + eventId + " : " + e.getMessage());
            return List.of();
        }
    }

    private void broadcast(List<String> recipients, String subject, String message) {
        try {
            String base = uriOf("notification-service");
            if (base == null) return;

            Map<String, Object> body = new HashMap<>();
            body.put("subject", subject);
            body.put("message", message);
            body.put("recipients", recipients);

            HttpHeaders h = authHeaders();
            h.setContentType(MediaType.APPLICATION_JSON);
            rest.exchange(base + "/api/notifications/broadcast",
                    HttpMethod.POST, new HttpEntity<>(body, h), Map.class);
            System.out.println("[Notify] " + recipients.size() + " participant(s) prévenu(s) : " + subject);
        } catch (Exception e) {
            System.err.println("[Notify] diffusion échouée : " + e.getMessage());
        }
    }

    private String uriOf(String serviceName) {
        List<ServiceInstance> insts = discoveryClient.getInstances(serviceName);
        if (insts.isEmpty()) {
            System.err.println("[Notify] service introuvable dans Eureka : " + serviceName);
            return null;
        }
        return insts.get(0).getUri().toString();
    }

    /** Propage le jeton de l'appelant : les deux endpoints visés exigent une authentification. */
    private HttpHeaders authHeaders() {
        HttpHeaders h = new HttpHeaders();
        try {
            Object auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jt) h.setBearerAuth(jt.getToken().getTokenValue());
        } catch (Exception ignored) { }
        return h;
    }
}
