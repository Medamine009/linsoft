package com.pfe.events.userservice.services;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class KeycloakAdminClient {

    @Value("${keycloak.admin-url:http://localhost:8085}")
    private String keycloakUrl;

    @Value("${keycloak.admin-realm:master}")
    private String adminRealm;

    @Value("${keycloak.admin-client-id:admin-cli}")
    private String adminClientId;

    @Value("${keycloak.admin-username:admin}")
    private String adminUsername;

    @Value("${keycloak.admin-password:admin}")
    private String adminPassword;

    @Value("${keycloak.target-realm:pfe-events}")
    private String targetRealm;

    private final RestTemplate rest = new RestTemplate();

    /** Obtient un token admin via password grant sur le realm master. */
    @SuppressWarnings("unchecked")
    private String getAdminToken() {
        String url = keycloakUrl + "/realms/" + adminRealm + "/protocol/openid-connect/token";
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
        MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
        body.add("grant_type", "password");
        body.add("client_id", adminClientId);
        body.add("username", adminUsername);
        body.add("password", adminPassword);
        ResponseEntity<Map> resp = rest.postForEntity(url, new HttpEntity<>(body, headers), Map.class);
        if (resp.getStatusCode() != HttpStatus.OK || resp.getBody() == null) {
            throw new RuntimeException("Impossible d'obtenir un token admin Keycloak");
        }
        return (String) resp.getBody().get("access_token");
    }

    /** Retourne le rôle realm avec son ID. */
    @SuppressWarnings("unchecked")
    private Map<String, Object> findRealmRole(String token, String roleName) {
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/roles/" + roleName;
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        ResponseEntity<Map> resp = rest.exchange(url, HttpMethod.GET, new HttpEntity<>(h), Map.class);
        if (resp.getStatusCode() != HttpStatus.OK || resp.getBody() == null) {
            throw new RuntimeException("Role introuvable : " + roleName);
        }
        return resp.getBody();
    }

    /** Liste les rôles actuellement assignés à un user. */
    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> getUserRoles(String keycloakUserId) {
        String token = getAdminToken();
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/users/" + keycloakUserId + "/role-mappings/realm";
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        ResponseEntity<List> resp = rest.exchange(url, HttpMethod.GET, new HttpEntity<>(h), List.class);
        return resp.getBody();
    }

    /** Ajoute un rôle realm à un user. */
    public void addRealmRole(String keycloakUserId, String roleName) {
        String token = getAdminToken();
        Map<String, Object> role = findRealmRole(token, roleName);
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/users/" + keycloakUserId + "/role-mappings/realm";
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        List<Map<String, Object>> body = List.of(role);
        rest.postForEntity(url, new HttpEntity<>(body, h), Void.class);
    }

    /**
     * Termine toutes les sessions Keycloak d'un utilisateur : il est déconnecté
     * de tous ses appareils, pas seulement du navigateur courant.
     */
    public void logoutAllSessions(String keycloakUserId) {
        String token = getAdminToken();
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/users/" + keycloakUserId + "/logout";
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        rest.postForEntity(url, new HttpEntity<>(h), Void.class);
    }

    /** Active ou désactive un compte Keycloak (un compte désactivé ne peut plus se connecter). */
    public void setEnabled(String keycloakUserId, boolean enabled) {
        String token = getAdminToken();
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/users/" + keycloakUserId;
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> body = Map.of("enabled", enabled);
        rest.exchange(url, HttpMethod.PUT, new HttpEntity<>(body, h), Void.class);
    }

    /** Supprime définitivement un utilisateur dans Keycloak. */
    public void deleteUser(String keycloakUserId) {
        String token = getAdminToken();
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/users/" + keycloakUserId;
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        rest.exchange(url, HttpMethod.DELETE, new HttpEntity<>(h), Void.class);
    }

    /** Retire un rôle realm d'un user. */
    public void removeRealmRole(String keycloakUserId, String roleName) {
        String token = getAdminToken();
        Map<String, Object> role = findRealmRole(token, roleName);
        String url = keycloakUrl + "/admin/realms/" + targetRealm + "/users/" + keycloakUserId + "/role-mappings/realm";
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        h.setContentType(MediaType.APPLICATION_JSON);
        List<Map<String, Object>> body = List.of(role);
        rest.exchange(url, HttpMethod.DELETE, new HttpEntity<>(body, h), Void.class);
    }
}
