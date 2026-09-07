package com.pfe.events.feedbackservice.controllers;

import com.pfe.events.feedbackservice.entities.Feedback;
import com.pfe.events.feedbackservice.services.FeedbackService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    @Autowired
    private FeedbackService feedbackService;

    /**
     * Dépose un avis.
     *
     * <p>L'auteur n'est jamais lu depuis le corps de la requête : identifiant et
     * nom proviennent du jeton, faute de quoi n'importe quel appelant pourrait
     * publier un avis sous l'identité d'un autre.</p>
     */
    @PostMapping
    public ResponseEntity<Feedback> createFeedback(@RequestBody Feedback feedback,
                                                   Authentication auth) {
        try {
            String callerId = callerId(auth);
            if (!callerId.isBlank()) {
                feedback.setUserId(callerId);
                feedback.setUserName(callerName(auth));
            }
            Feedback created = feedbackService.createFeedback(feedback);
            return new ResponseEntity<>(created, HttpStatus.CREATED);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<Feedback>> getFeedbacksByEvent(@PathVariable String eventId) {
        return ResponseEntity.ok(feedbackService.getFeedbacksByEvent(eventId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Feedback>> getFeedbacksByUser(@PathVariable String userId) {
        return ResponseEntity.ok(feedbackService.getFeedbacksByUser(userId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Feedback> getFeedbackById(@PathVariable String id) {
        return feedbackService.getFeedbackById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/event/{eventId}/average")
    public ResponseEntity<Map<String, Double>> getAverageRating(@PathVariable String eventId) {
        double avg = feedbackService.getAverageRatingForEvent(eventId);
        return ResponseEntity.ok(Map.of("averageRating", avg));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFeedback(@PathVariable String id) {
        feedbackService.deleteFeedback(id);
        return ResponseEntity.noContent().build();
    }

    /** Identifiant Keycloak (sub) de l'appelant. */
    private String callerId(Authentication auth) {
        if (auth instanceof JwtAuthenticationToken jt) {
            return String.valueOf(jt.getToken().getSubject());
        }
        return "";
    }

    /** Nom lisible de l'appelant, recopié sur l'avis pour l'affichage. */
    private String callerName(Authentication auth) {
        if (auth instanceof JwtAuthenticationToken jt) {
            String name = jt.getToken().getClaimAsString("name");
            if (name == null || name.isBlank()) name = jt.getToken().getClaimAsString("preferred_username");
            if (name != null && !name.isBlank()) return name;
        }
        return auth != null ? auth.getName() : "";
    }
}
