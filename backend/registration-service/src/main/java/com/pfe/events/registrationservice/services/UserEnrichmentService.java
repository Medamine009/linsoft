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
public class UserEnrichmentService {

    private final DiscoveryClient discoveryClient;
    private final RestTemplate rest = new RestTemplate();

    public UserEnrichmentService(DiscoveryClient discoveryClient) {
        this.discoveryClient = discoveryClient;
    }

    public static class UserInfo {
        public String email;
        public String firstName;
        public String lastName;
    }

    @SuppressWarnings("unchecked")
    public UserInfo fetch(String keycloakId) {
        try {
            List<ServiceInstance> insts = discoveryClient.getInstances("user-service");
            if (insts.isEmpty()) return null;
            String url = insts.get(0).getUri() + "/api/users/keycloak/" + keycloakId;

            HttpHeaders h = new HttpHeaders();
            String token = currentToken();
            if (token != null) h.setBearerAuth(token);

            ResponseEntity<Map> resp = rest.exchange(url, HttpMethod.GET, new HttpEntity<>(h), Map.class);
            Map<String, Object> body = resp.getBody();
            if (body == null) return null;
            UserInfo info = new UserInfo();
            info.email = (String) body.get("email");
            info.firstName = (String) body.get("firstName");
            info.lastName = (String) body.get("lastName");
            return info;
        } catch (Exception e) {
            System.err.println("[Enrichment] user fetch failed: " + e.getMessage());
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
