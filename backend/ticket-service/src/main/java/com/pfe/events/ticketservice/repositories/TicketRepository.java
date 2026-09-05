package com.pfe.events.ticketservice.repositories;

import com.pfe.events.ticketservice.entities.Ticket;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface TicketRepository extends MongoRepository<Ticket, String> {
    List<Ticket> findByEventId(String eventId);
    List<Ticket> findByAttendeeId(String attendeeId);
    Optional<Ticket> findByRegistrationId(String registrationId);
}
