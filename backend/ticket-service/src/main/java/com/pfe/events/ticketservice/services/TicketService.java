package com.pfe.events.ticketservice.services;

import com.pfe.events.ticketservice.entities.Ticket;
import com.pfe.events.ticketservice.repositories.TicketRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class TicketService {

    @Autowired
    private TicketRepository ticketRepository;

    public Ticket createTicket(String registrationId, String eventId, String attendeeId) {
        Ticket ticket = new Ticket();
        ticket.setRegistrationId(registrationId);
        ticket.setEventId(eventId);
        ticket.setAttendeeId(attendeeId);
        ticket.setQrCode("QR-" + UUID.randomUUID().toString());
        return ticketRepository.save(ticket);
    }

    public List<Ticket> getTicketsByEvent(String eventId) {
        return ticketRepository.findByEventId(eventId);
    }

    public List<Ticket> getTicketsByAttendee(String attendeeId) {
        return ticketRepository.findByAttendeeId(attendeeId);
    }

    public Optional<Ticket> getTicketById(String id) {
        return ticketRepository.findById(id);
    }

    public Optional<Ticket> getTicketByRegistration(String registrationId) {
        return ticketRepository.findByRegistrationId(registrationId);
    }

    public Ticket validateTicket(String id) {
        return ticketRepository.findById(id).map(ticket -> {
            if ("VALID".equals(ticket.getStatus())) {
                ticket.setStatus("USED");
                return ticketRepository.save(ticket);
            }
            throw new RuntimeException("Ticket already used or cancelled");
        }).orElseThrow(() -> new RuntimeException("Ticket not found: " + id));
    }

    public Ticket cancelTicket(String id) {
        return ticketRepository.findById(id).map(ticket -> {
            ticket.setStatus("CANCELLED");
            return ticketRepository.save(ticket);
        }).orElseThrow(() -> new RuntimeException("Ticket not found: " + id));
    }
}
