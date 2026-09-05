package com.pfe.events.eventservice.repositories;

import com.pfe.events.eventservice.entities.Event;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EventRepository extends MongoRepository<Event, String> {
    List<Event> findByCategory(String category);
    List<Event> findByOrganizerId(String organizerId);
}
