package com.pfe.events.registrationservice.services;

import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.http.*;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Service
public class EventEnrichmentService {

    private final DiscoveryClient discoveryClient;
    private final RestTemplate rest = new RestTemplate();

    public EventEnrichmentService(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public static class EventInfo {
        public String title;
        public Object eventDate;
        public String location;
        public String category;
        /** Durée libellée (« 3 jours », « 4 heures ») — base du calcul de fin de session. */
        public String duration;
    }

    @SuppressWarnings("unchecked")
    public EventInfo fetch(String eventId) {
        try {
            List<ServiceInstance> insts = discoveryClient.getInstances("event-service");
            if (insts.isEmpty()) return null;
            String url = insts.get(0).getUri() + "/api/events/" + eventId;

            HttpHeaders h = new HttpHeaders();
            String token = currentToken();
            if (token != null) h.setBearerAuth(token);

            ResponseEntity<Map> resp = rest.exchange(url, HttpMethod.GET, new HttpEntity<>(h), Map.class);
            Map<String, Object> body = resp.getBody();
            if (body == null) return null;
            EventInfo info = new EventInfo();
            info.title = (String) body.get("title");
            info.eventDate = body.get("eventDate");
            info.location = (String) body.get("location");
            info.category = (String) body.get("category");
            info.duration = (String) body.get("duration");
            return info;
        } catch (Exception e) {
            System.err.println("[Enrichment] event fetch failed: " + e.getMessage());
            return null;
        }
    }

    private String currentToken() {
        try {
            Object auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth instanceof JwtAuthenticationToken jt) {
                Jwt jwt = jt.getToken();
                return jwt.getTokenValue();
            }
        } catch (Exception ignored) {}
        return null;
    }
}
