package com.pfe.events.userservice.controllers;

import com.pfe.events.userservice.config.JwtAuthConverter;
import com.pfe.events.userservice.config.SecurityConfig;
import com.pfe.events.userservice.entities.User;
import com.pfe.events.userservice.services.KeycloakAdminClient;
import com.pfe.events.userservice.services.UserService;
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
 * Contrôle d'accès de l'API utilisateurs.
 *
 * <p>C'est l'API la plus sensible de la plateforme : elle expose l'annuaire des
 * collaborateurs et permet d'attribuer des rôles. Les tests chargent la
 * configuration de sécurité réelle et vérifient qu'un participant ne peut ni
 * lister, ni supprimer, ni promouvoir qui que ce soit.</p>
 */
@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, JwtAuthConverter.class})
class UserControllerSecurityTest {

    @Autowired MockMvc mvc;

    @MockBean UserService userService;
    @MockBean KeycloakAdminClient keycloakAdmin;
    @MockBean JwtDecoder jwtDecoder;

    private RequestPostProcessor participant() {
        return jwt().jwt(j -> j.subject("kc-participant")
                        .claim("email", "y.gharbi@linsoft.tn")
                        .claim("given_name", "Yassine").claim("family_name", "Gharbi")
                        .claim("realm_access", java.util.Map.of("roles", List.of("PARTICIPANT"))))
                .authorities(new SimpleGrantedAuthority("ROLE_PARTICIPANT"));
    }

    private RequestPostProcessor admin() {
        return jwt().jwt(j -> j.subject("kc-admin")
                        .claim("email", "s.benamor@linsoft.tn")
                        .claim("realm_access", java.util.Map.of("roles", List.of("ADMIN"))))
                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"));
    }

    private User user(String keycloakId, String role) {
        User u = new User();
        u.setId(1L);
        u.setKeycloakId(keycloakId);
        u.setEmail("y.gharbi@linsoft.tn");
        u.setFirstName("Yassine");
        u.setLastName("Gharbi");
        u.setRole(role);
        return u;
    }

    // ═══════════ Annuaire ═══════════

    @Test
    void listingUsersIsReservedToAdmin() throws Exception {
        when(userService.getAllUsers()).thenReturn(List.of(user("kc-1", "PARTICIPANT")));

        mvc.perform(get("/api/users").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].email").value("y.gharbi@linsoft.tn"));

        // L'annuaire complet des collaborateurs n'est pas une donnée publique.
        mvc.perform(get("/api/users").with(participant()))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/users"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletingAnAccountIsReservedToAdmin() throws Exception {
        mvc.perform(delete("/api/users/keycloak/kc-1").with(participant()))
                .andExpect(status().isForbidden());
        verify(userService, never()).deleteUser(anyString());

        mvc.perform(delete("/api/users/keycloak/kc-1").with(admin()))
                .andExpect(status().isNoContent());
        verify(userService).deleteUser("kc-1");
    }

    @Test
    void assigningARoleIsReservedToAdmin() throws Exception {
        when(userService.getUserByKeycloakId("kc-1")).thenReturn(Optional.of(user("kc-1", "PARTICIPANT")));

        // Une élévation de privilège par un participant serait la faille la plus grave.
        mvc.perform(put("/api/users/keycloak/kc-1/assign-role").param("role", "ADMIN").with(participant()))
                .andExpect(status().isForbidden());
        verify(keycloakAdmin, never()).addRealmRole(anyString(), anyString());

        mvc.perform(put("/api/users/keycloak/kc-1/assign-role").param("role", "ORGANISATEUR").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));
        verify(keycloakAdmin).addRealmRole("kc-1", "ORGANISATEUR");
    }

    @Test
    void assigningAnUnknownRoleIsRejected() throws Exception {
        mvc.perform(put("/api/users/keycloak/kc-1/assign-role").param("role", "SUPERUSER").with(admin()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
        verify(keycloakAdmin, never()).addRealmRole(anyString(), anyString());
    }

    @Test
    void assigningARoleRemovesTheOtherApplicationRoles() throws Exception {
        when(userService.getUserByKeycloakId("kc-1")).thenReturn(Optional.of(user("kc-1", "ADMIN")));

        mvc.perform(put("/api/users/keycloak/kc-1/assign-role").param("role", "PARTICIPANT").with(admin()))
                .andExpect(status().isOk());

        // Sans le retrait, un administrateur rétrogradé garderait ADMIN dans son jeton.
        verify(keycloakAdmin).removeRealmRole("kc-1", "ADMIN");
        verify(keycloakAdmin).removeRealmRole("kc-1", "ORGANISATEUR");
        verify(keycloakAdmin, never()).removeRealmRole("kc-1", "PARTICIPANT");
    }

    // ═══════════ Fiche personnelle ═══════════

    @Test
    void meRequiresAuthentication() throws Exception {
        mvc.perform(get("/api/users/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void meCreatesTheProfileOnFirstLogin() throws Exception {
        when(userService.getUserByKeycloakId("kc-participant")).thenReturn(Optional.empty());
        when(userService.createUser(any(User.class))).thenAnswer(i -> i.getArgument(0));

        mvc.perform(get("/api/users/me").with(participant()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("y.gharbi@linsoft.tn"))
                .andExpect(jsonPath("$.firstName").value("Yassine"))
                .andExpect(jsonPath("$.role").value("PARTICIPANT"));

        verify(userService).createUser(any(User.class));
    }

    @Test
    void meRealignsTheRoleWhenKeycloakDisagreesWithTheDatabase() throws Exception {
        // La fiche dit PARTICIPANT, le jeton dit ADMIN : le jeton fait autorité.
        when(userService.getUserByKeycloakId("kc-admin")).thenReturn(Optional.of(user("kc-admin", "PARTICIPANT")));
        when(userService.updateUser(anyString(), any(User.class))).thenAnswer(i -> i.getArgument(1));

        mvc.perform(get("/api/users/me").with(admin()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value("ADMIN"));

        verify(userService).updateUser(eq("kc-admin"), any(User.class));
    }

    @Test
    void meDoesNotRewriteTheProfileWhenTheRoleAlreadyMatches() throws Exception {
        when(userService.getUserByKeycloakId("kc-participant"))
                .thenReturn(Optional.of(user("kc-participant", "PARTICIPANT")));

        mvc.perform(get("/api/users/me").with(participant())).andExpect(status().isOk());

        verify(userService, never()).updateUser(anyString(), any(User.class));
    }

    // ═══════════ Consultation d'une fiche ═══════════

    @Test
    void anAuthenticatedUserMayResolveAProfileByKeycloakId() throws Exception {
        // Les services (registration, notification) s'appuient sur cet endpoint
        // pour enrichir un nom ou une adresse : il reste ouvert aux comptes connectés.
        when(userService.getUserByKeycloakId("kc-1")).thenReturn(Optional.of(user("kc-1", "PARTICIPANT")));

        mvc.perform(get("/api/users/keycloak/kc-1").with(participant()))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users/keycloak/kc-1"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownProfileReturnsNotFound() throws Exception {
        when(userService.getUserByKeycloakId("inconnu")).thenReturn(Optional.empty());

        mvc.perform(get("/api/users/keycloak/inconnu").with(admin()))
                .andExpect(status().isNotFound());
    }

    @Test
    void updatingAnUnknownProfileReturnsNotFound() throws Exception {
        when(userService.updateUser(anyString(), any(User.class)))
                .thenThrow(new RuntimeException("User not found"));

        mvc.perform(put("/api/users/keycloak/inconnu")
                        .with(admin())
                        .contentType("application/json")
                        .content("{\"firstName\":\"X\",\"lastName\":\"Y\"}"))
                .andExpect(status().isNotFound());
    }
}
