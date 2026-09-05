package com.pfe.events.userservice.services;

import com.pfe.events.userservice.entities.User;
import com.pfe.events.userservice.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    public User createUser(User user) {
        if (userRepository.findByKeycloakId(user.getKeycloakId()).isPresent()) {
            throw new RuntimeException("User already exists with keycloakId: " + user.getKeycloakId());
        }
        return userRepository.save(user);
    }

    public List<User> getAllUsers() {
        return userRepository.findAll();
    }

    public Optional<User> getUserById(Long id) {
        return userRepository.findById(id);
    }

    public Optional<User> getUserByKeycloakId(String keycloakId) {
        return userRepository.findByKeycloakId(keycloakId);
    }

    public User updateUser(String keycloakId, User userDetails) {
        return userRepository.findByKeycloakId(keycloakId).map(user -> {
            user.setFirstName(userDetails.getFirstName());
            user.setLastName(userDetails.getLastName());
            user.setEmail(userDetails.getEmail());
            user.setPhoneNumber(userDetails.getPhoneNumber());
            user.setBio(userDetails.getBio());
            user.setPhotoUrl(userDetails.getPhotoUrl());
            user.setProfileComplete(userDetails.isProfileComplete());
            if (userDetails.getDepartment() != null) {
                user.setDepartment(userDetails.getDepartment());
            }
            // Role should probably be updated via Keycloak sync, but we allow it here for now
            if (userDetails.getRole() != null) {
                user.setRole(userDetails.getRole());
            }
            return userRepository.save(user);
        }).orElseThrow(() -> new RuntimeException("User not found with Keycloak ID: " + keycloakId));
    }

    /** Reflète en base l'état actif/inactif du compte Keycloak. */
    public User setEnabled(String keycloakId, boolean enabled) {
        return userRepository.findByKeycloakId(keycloakId).map(user -> {
            user.setEnabled(enabled);
            return userRepository.save(user);
        }).orElseThrow(() -> new RuntimeException("User not found with Keycloak ID: " + keycloakId));
    }

    public void deleteUser(String keycloakId) {
        User user = userRepository.findByKeycloakId(keycloakId)
                .orElseThrow(() -> new RuntimeException("User not found with Keycloak ID: " + keycloakId));
        userRepository.delete(user);
    }
}
