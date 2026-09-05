package com.pfe.events.feedbackservice.services;

import com.pfe.events.feedbackservice.entities.Feedback;
import com.pfe.events.feedbackservice.repositories.FeedbackRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class FeedbackService {

    @Autowired
    private FeedbackRepository feedbackRepository;

    public Feedback createFeedback(Feedback feedback) {
        // Un utilisateur ne peut laisser qu'un seul feedback par événement
        if (feedbackRepository.existsByEventIdAndUserId(feedback.getEventId(), feedback.getUserId())) {
            throw new RuntimeException("User has already submitted feedback for this event.");
        }
        return feedbackRepository.save(feedback);
    }

    public List<Feedback> getFeedbacksByEvent(String eventId) {
        return feedbackRepository.findByEventId(eventId);
    }

    public List<Feedback> getFeedbacksByUser(String userId) {
        return feedbackRepository.findByUserId(userId);
    }

    public Optional<Feedback> getFeedbackById(String id) {
        return feedbackRepository.findById(id);
    }

    public void deleteFeedback(String id) {
        feedbackRepository.deleteById(id);
    }

    public double getAverageRatingForEvent(String eventId) {
        List<Feedback> feedbacks = feedbackRepository.findByEventId(eventId);
        if (feedbacks.isEmpty()) return 0;
        return feedbacks.stream().mapToInt(Feedback::getRating).average().orElse(0);
    }
}
