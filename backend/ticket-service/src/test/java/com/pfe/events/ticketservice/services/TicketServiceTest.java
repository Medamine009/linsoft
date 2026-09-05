package com.pfe.events.ticketservice.services;

import com.pfe.events.ticketservice.entities.Ticket;
import com.pfe.events.ticketservice.repositories.TicketRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TicketServiceTest {

    @Mock TicketRepository ticketRepository;
    @InjectMocks TicketService service;

    @Test
    void validateTicket_movesValidToUsed() {
        Ticket t = new Ticket();
        t.setId("t1");
        t.setStatus("VALID");
        when(ticketRepository.findById("t1")).thenReturn(Optional.of(t));
        when(ticketRepository.save(any(Ticket.class))).thenAnswer(i -> i.getArgument(0));

        Ticket validated = service.validateTicket("t1");

        assertEquals("USED", validated.getStatus());
    }

    @Test
    void validateTicket_rejectsAlreadyUsed() {
        Ticket t = new Ticket();
        t.setId("t2");
        t.setStatus("USED");
        when(ticketRepository.findById("t2")).thenReturn(Optional.of(t));

        assertThrows(RuntimeException.class, () -> service.validateTicket("t2"));
        verify(ticketRepository, never()).save(any());
    }
}
