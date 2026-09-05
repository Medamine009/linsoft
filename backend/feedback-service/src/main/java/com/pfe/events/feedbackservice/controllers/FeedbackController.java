package com.pfe.events.feedbackservice.controllers;

import com.pfe.events.feedbackservice.entities.Feedback;
import com.pfe.events.feedbackservice.services.FeedbackService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/feedback")
public class FeedbackController {

    @Autowired
    private FeedbackService feedbackService;

    @PostMapping
    public ResponseEntity<Feedback> createFeedback(@RequestBody Feedback feedback) {
        try {
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
}
