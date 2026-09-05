package com.pfe.events.userservice.services;

import com.pfe.events.userservice.entities.User;
import com.pfe.events.userservice.repositories.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Règles métier de la fiche collaborateur.
 *
 * <p>Le service est le seul garde-fou entre le contrôleur et la base : c'est ici
 * que se joue l'unicité du compte Keycloak et le comportement attendu quand la
 * fiche visée n'existe pas.</p>
 */
@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock UserRepository userRepository;
    @InjectMocks UserService service;

    private User collaborator(String keycloakId, String email) {
        User u = new User();
        u.setKeycloakId(keycloakId);
        u.setEmail(email);
        u.setFirstName("Yassine");
        u.setLastName("Gharbi");
        u.setRole("PARTICIPANT");
        u.setDepartment("Developpement");
        return u;
    }

    // ─────────────── Création ───────────────

    @Test
    void createUser_persistsWhenKeycloakIdIsFree() {
        User u = collaborator("kc-1", "y.gharbi@linsoft.tn");
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.empty());
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User saved = service.createUser(u);

        assertEquals("y.gharbi@linsoft.tn", saved.getEmail());
        verify(userRepository).save(u);
    }

    @Test
    void createUser_rejectsDuplicateKeycloakId() {
        User existing = collaborator("kc-1", "y.gharbi@linsoft.tn");
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> service.createUser(collaborator("kc-1", "autre@linsoft.tn")));

        assertTrue(ex.getMessage().contains("kc-1"));
        // Un doublon ne doit jamais atteindre la base : deux fiches pour un même
        // compte Keycloak casseraient toute la resolution d'identite.
        verify(userRepository, never()).save(any());
    }

    // ─────────────── Mise à jour ───────────────

    @Test
    void updateUser_appliesProfileFields() {
        User existing = collaborator("kc-1", "ancien@linsoft.tn");
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        User patch = new User();
        patch.setFirstName("Yassine");
        patch.setLastName("Gharbi");
        patch.setEmail("nouveau@linsoft.tn");
        patch.setPhoneNumber("+216 94 220 815");
        patch.setBio("Developpeur back-end");
        patch.setProfileComplete(true);
        patch.setDepartment("Data & IA");
        patch.setRole("ORGANISATEUR");

        User updated = service.updateUser("kc-1", patch);

        assertEquals("nouveau@linsoft.tn", updated.getEmail());
        assertEquals("+216 94 220 815", updated.getPhoneNumber());
        assertTrue(updated.isProfileComplete());
        assertEquals("Data & IA", updated.getDepartment());
        assertEquals("ORGANISATEUR", updated.getRole());
    }

    @Test
    void updateUser_keepsDepartmentAndRoleWhenPatchOmitsThem() {
        User existing = collaborator("kc-1", "y.gharbi@linsoft.tn");
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        // Le formulaire de profil n'envoie ni le departement ni le role : une mise
        // a jour partielle ne doit pas les effacer.
        User patch = new User();
        patch.setFirstName("Yassine");
        patch.setLastName("Gharbi");
        patch.setEmail("y.gharbi@linsoft.tn");

        User updated = service.updateUser("kc-1", patch);

        assertEquals("Developpement", updated.getDepartment());
        assertEquals("PARTICIPANT", updated.getRole());
    }

    @Test
    void updateUser_failsWhenAccountIsUnknown() {
        when(userRepository.findByKeycloakId("inconnu")).thenReturn(Optional.empty());

        RuntimeException ex = assertThrows(RuntimeException.class,
                () -> service.updateUser("inconnu", new User()));

        assertTrue(ex.getMessage().contains("inconnu"));
        verify(userRepository, never()).save(any());
    }

    // ─────────────── Activation / désactivation ───────────────

    @Test
    void setEnabled_mirrorsKeycloakState() {
        User existing = collaborator("kc-1", "y.gharbi@linsoft.tn");
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));
        when(userRepository.save(any(User.class))).thenAnswer(i -> i.getArgument(0));

        assertFalse(service.setEnabled("kc-1", false).isActive());
        assertTrue(service.setEnabled("kc-1", true).isActive());
    }

    @Test
    void isActive_treatsLegacyNullAsEnabled() {
        // Colonne ajoutée après coup sur une table déjà peuplée : `null` doit
        // valoir « actif », sinon tous les comptes historiques seraient bloqués.
        User legacy = collaborator("kc-legacy", "ancien@linsoft.tn");
        assertNull(legacy.getEnabled());
        assertTrue(legacy.isActive());
    }

    @Test
    void setEnabled_failsWhenAccountIsUnknown() {
        when(userRepository.findByKeycloakId("inconnu")).thenReturn(Optional.empty());
        assertThrows(RuntimeException.class, () -> service.setEnabled("inconnu", false));
    }

    // ─────────────── Suppression ───────────────

    @Test
    void deleteUser_removesExistingAccount() {
        User existing = collaborator("kc-1", "y.gharbi@linsoft.tn");
        when(userRepository.findByKeycloakId("kc-1")).thenReturn(Optional.of(existing));

        service.deleteUser("kc-1");

        verify(userRepository).delete(existing);
    }

    @Test
    void deleteUser_failsWhenAccountIsUnknown() {
        when(userRepository.findByKeycloakId("inconnu")).thenReturn(Optional.empty());

        assertThrows(RuntimeException.class, () -> service.deleteUser("inconnu"));
        verify(userRepository, never()).delete(any());
    }

    // ─────────────── Lectures ───────────────

    @Test
    void getUserByKeycloakId_returnsEmptyRatherThanThrowing() {
        when(userRepository.findByKeycloakId("inconnu")).thenReturn(Optional.empty());
        assertTrue(service.getUserByKeycloakId("inconnu").isEmpty());
    }

    @Test
    void getAllUsers_delegatesToRepository() {
        when(userRepository.findAll()).thenReturn(List.of(
                collaborator("kc-1", "a@linsoft.tn"),
                collaborator("kc-2", "b@linsoft.tn")));

        assertEquals(2, service.getAllUsers().size());
    }
}
