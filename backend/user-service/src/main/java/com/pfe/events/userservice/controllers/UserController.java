package com.pfe.events.userservice.controllers;

import com.pfe.events.userservice.entities.User;
import com.pfe.events.userservice.services.KeycloakAdminClient;
import com.pfe.events.userservice.services.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserService userService;

    @Autowired
    private KeycloakAdminClient keycloakAdmin;

    /** GET /api/users/me — auto-crée le user à partir du JWT s'il n'existe pas. */
    @GetMapping("/me")
    public ResponseEntity<User> me(@AuthenticationPrincipal Jwt jwt) {
        String keycloakId = jwt.getSubject();
        String email = jwt.getClaimAsString("email");
        String firstName = jwt.getClaimAsString("given_name");
        String lastName = jwt.getClaimAsString("family_name");
        String preferredUsername = jwt.getClaimAsString("preferred_username");
        String mainRole = extractMainRole(jwt);

        User user = userService.getUserByKeycloakId(keycloakId).orElseGet(() -> {
            User u = new User();
            u.setKeycloakId(keycloakId);
            u.setEmail(email != null ? email : (preferredUsername != null ? preferredUsername + "@local" : "unknown@local"));
            u.setFirstName(firstName != null ? firstName : (preferredUsername != null ? preferredUsername : "User"));
            u.setLastName(lastName != null ? lastName : "");
            u.setRole(mainRole);
            return userService.createUser(u);
        });

        if (mainRole != null && !mainRole.equals(user.getRole())) {
            user.setRole(mainRole);
            user = userService.updateUser(keycloakId, user);
        }
        return ResponseEntity.ok(user);
    }

    /** POST /api/users/me/logout-all — termine toutes les sessions de l'utilisateur courant. */
    @PostMapping("/me/logout-all")
    public ResponseEntity<Map<String, Object>> logoutAll(@AuthenticationPrincipal Jwt jwt) {
        try {
            keycloakAdmin.logoutAllSessions(jwt.getSubject());
            return ResponseEntity.ok(Map.of("success", true, "message", "Toutes les sessions ont été fermées."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Erreur : " + e.getMessage()));
        }
    }

    /** POST /api/users/me/disable — désactive le compte de l'utilisateur courant. */
    @PostMapping("/me/disable")
    public ResponseEntity<Map<String, Object>> disableMe(@AuthenticationPrincipal Jwt jwt) {
        try {
            String id = jwt.getSubject();
            keycloakAdmin.setEnabled(id, false);
            // Le compte étant désactivé, on ferme aussi ses sessions en cours.
            keycloakAdmin.logoutAllSessions(id);
            // L'état doit aussi être visible dans la console d'administration.
            try { userService.setEnabled(id, false); } catch (RuntimeException ignored) { }
            return ResponseEntity.ok(Map.of("success", true,
                    "message", "Compte désactivé. Un administrateur peut le réactiver."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Erreur : " + e.getMessage()));
        }
    }

    /** POST /api/users/me/become-organizer — upgrade le rôle du user courant vers ORGANISATEUR. */
    @PostMapping("/me/become-organizer")
    public ResponseEntity<Map<String, Object>> becomeOrganizer(@AuthenticationPrincipal Jwt jwt) {
        String keycloakId = jwt.getSubject();
        try {
            keycloakAdmin.addRealmRole(keycloakId, "ORGANISATEUR");
            // Mettre à jour le rôle en BDD
            userService.getUserByKeycloakId(keycloakId).ifPresent(u -> {
                u.setRole("ORGANISATEUR");
                userService.updateUser(keycloakId, u);
            });
            Map<String, Object> response = new HashMap<>();
            response.put("success", true);
            response.put("message", "Rôle ORGANISATEUR assigné. Reconnectez-vous pour activer.");
            response.put("requiresRelogin", true);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", "Erreur : " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(err);
        }
    }

    @SuppressWarnings("unchecked")
    private String extractMainRole(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaim("realm_access");
        if (realmAccess == null) return "PARTICIPANT";
        List<String> roles = (List<String>) realmAccess.get("roles");
        if (roles == null) return "PARTICIPANT";
        if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("ADMIN"))) return "ADMIN";
        if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("ORGANISATEUR"))) return "ORGANISATEUR";
        if (roles.stream().anyMatch(r -> r.equalsIgnoreCase("PARTICIPANT"))) return "PARTICIPANT";
        return "PARTICIPANT";
    }

    /**
     * PUT /api/users/keycloak/{keycloakId}/assign-role?role=ORGANISATEUR
     * L'admin attribue un rôle à un collaborateur (réservé ADMIN via la config de sécurité).
     * Met à jour Keycloak ET la base. L'utilisateur devra se reconnecter pour rafraîchir son JWT.
     */
    @PutMapping("/keycloak/{keycloakId}/assign-role")
    public ResponseEntity<Map<String, Object>> assignRole(
            @PathVariable String keycloakId,
            @RequestParam String role) {
        Map<String, Object> response = new HashMap<>();
        try {
            String target = role.toUpperCase();
            if (!target.equals("PARTICIPANT") && !target.equals("ORGANISATEUR") && !target.equals("ADMIN")) {
                response.put("success", false);
                response.put("message", "Rôle invalide");
                return ResponseEntity.badRequest().body(response);
            }
            // Vrai changement de rôle : on ajoute le rôle cible et on RETIRE les autres
            // rôles applicatifs (sinon un admin rétrogradé garderait ADMIN dans son token).
            keycloakAdmin.addRealmRole(keycloakId, target);
            for (String other : new String[]{"PARTICIPANT", "ORGANISATEUR", "ADMIN"}) {
                if (!other.equals(target)) {
                    try { keycloakAdmin.removeRealmRole(keycloakId, other); } catch (Exception ignored) {}
                }
            }
            userService.getUserByKeycloakId(keycloakId).ifPresent(u -> {
                u.setRole(target);
                userService.updateUser(keycloakId, u);
            });
            response.put("success", true);
            response.put("message", "Rôle " + target + " attribué. L'utilisateur doit se reconnecter pour l'activer.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            response.put("success", false);
            response.put("message", "Erreur : " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @PostMapping
    public ResponseEntity<User> createUser(@RequestBody User user) {
        User createdUser = userService.createUser(user);
        return new ResponseEntity<>(createdUser, HttpStatus.CREATED);
    }

    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Long id) {
        return userService.getUserById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/keycloak/{keycloakId}")
    public ResponseEntity<User> getUserByKeycloakId(@PathVariable String keycloakId) {
        return userService.getUserByKeycloakId(keycloakId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/keycloak/{keycloakId}")
    public ResponseEntity<User> updateUser(@PathVariable String keycloakId, @RequestBody User userDetails) {
        try {
            User updatedUser = userService.updateUser(keycloakId, userDetails);
            return ResponseEntity.ok(updatedUser);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * PUT /api/users/keycloak/{id}/enabled?value=true|false — active ou désactive
     * un compte (action réservée à l'administration).
     *
     * L'état fait autorité côté Keycloak : sans `enabled`, la connexion est
     * refusée. On le recopie en base pour que la liste des comptes l'affiche.
     */
    @PutMapping("/keycloak/{keycloakId}/enabled")
    public ResponseEntity<Map<String, Object>> setEnabled(@PathVariable String keycloakId,
                                                         @RequestParam boolean value) {
        try {
            keycloakAdmin.setEnabled(keycloakId, value);
            // Désactivation : on coupe aussi les sessions ouvertes.
            if (!value) keycloakAdmin.logoutAllSessions(keycloakId);
            try { userService.setEnabled(keycloakId, value); } catch (RuntimeException ignored) { }
            return ResponseEntity.ok(Map.of("success", true,
                    "enabled", value,
                    "message", value ? "Compte activé." : "Compte désactivé."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Erreur : " + e.getMessage()));
        }
    }

    /**
     * Supprime le compte des deux côtés. Sans la suppression dans Keycloak,
     * l'utilisateur pouvait encore se connecter et sa fiche était recréée par
     * /users/me à la connexion suivante.
     */
    @DeleteMapping("/keycloak/{keycloakId}")
    public ResponseEntity<Void> deleteUser(@PathVariable String keycloakId) {
        try {
            try { keycloakAdmin.deleteUser(keycloakId); } catch (Exception ignored) { }
            userService.deleteUser(keycloakId);
            return ResponseEntity.noContent().build();
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
