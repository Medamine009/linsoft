package com.pfe.events.registrationservice.services;

import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;

/**
 * Met à jour le champ availableSeats de l'event après une inscription / annulation.
 * Appelle l'endpoint dédié PUT /api/events/{id}/seats?delta=±1 (atomique, accessible
 * à tout user authentifié).
 */
@Service
public class EventSeatUpdater {

    private final DiscoveryClient discoveryClient;
    private final RestTemplate rest = new RestTemplate();

    public EventSeatUpdater(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public void decrement(String eventId) { adjust(eventId, -1); }
    public void increment(String eventId) { adjust(eventId, +1); }

    private void adjust(String eventId, int delta) {
        try {
            List<ServiceInstance> insts = discoveryClient.getInstances("event-service");
            if (insts.isEmpty()) return;
            String url = insts.get(0).getUri() + "/api/events/" + eventId + "/seats?delta=" + delta;

            HttpHeaders h = new HttpHeaders();
            String token = currentToken();
            if (token != null) h.setBearerAuth(token);

            rest.exchange(url, HttpMethod.PUT, new HttpEntity<>(h), Void.class);
            System.out.println("[Seats] event=" + eventId + " delta=" + delta + " OK");
        } catch (Exception e) {
            System.err.println("[Seats] adjust failed for " + eventId + " : " + e.getMessage());
        }
    }

    private String currentToken() {
        try {
            Object auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jt) return jt.getToken().getTokenValue();
        } catch (Exception ignored) {}
        return null;
    }
}
