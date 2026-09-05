package com.pfe.events.feedbackservice.services;

import com.pfe.events.feedbackservice.entities.Feedback;
import com.pfe.events.feedbackservice.repositories.FeedbackRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedbackServiceTest {

    @Mock FeedbackRepository feedbackRepository;
    @InjectMocks FeedbackService service;

    @Test
    void createFeedback_rejectsDuplicatePerUserAndEvent() {
        Feedback fb = new Feedback();
        fb.setEventId("e1");
        fb.setUserId("u1");
        when(feedbackRepository.existsByEventIdAndUserId("e1", "u1")).thenReturn(true);

        RuntimeException ex = assertThrows(RuntimeException.class, () -> service.createFeedback(fb));
        assertTrue(ex.getMessage().toLowerCase().contains("already"));
        verify(feedbackRepository, never()).save(any());
    }

    @Test
    void getAverageRatingForEvent_computesMean() {
        Feedback a = new Feedback(); a.setRating(4);
        Feedback b = new Feedback(); b.setRating(2);
        when(feedbackRepository.findByEventId("e1")).thenReturn(List.of(a, b));

        assertEquals(3.0, service.getAverageRatingForEvent("e1"), 0.001);
    }

    @Test
    void getAverageRatingForEvent_zeroWhenEmpty() {
        when(feedbackRepository.findByEventId("e2")).thenReturn(List.of());
        assertEquals(0.0, service.getAverageRatingForEvent("e2"), 0.001);
    }
}
