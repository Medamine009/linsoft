package com.pfe.events.feedbackservice.repositories;

import com.pfe.events.feedbackservice.entities.Feedback;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface FeedbackRepository extends MongoRepository<Feedback, String> {
    List<Feedback> findByEventId(String eventId);
    List<Feedback> findByUserId(String userId);
    boolean existsByEventIdAndUserId(String eventId, String userId);
}
