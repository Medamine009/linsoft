package com.pfe.events.ticketservice.controllers;

import com.pfe.events.ticketservice.entities.Ticket;
import com.pfe.events.ticketservice.services.QrCodeService;
import com.pfe.events.ticketservice.services.TicketService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tickets")
public class TicketController {

    @Autowired
    private TicketService ticketService;

    @Autowired
    private QrCodeService qrCodeService;

    /** Génère un QR code PNG. Le contenu (souvent une URL) passe en path OU en query param. */
    @GetMapping(value = "/qr/{data}", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getQrCode(
            @PathVariable String data,
            @RequestParam(defaultValue = "240") int size) {
        return buildQr(data, size);
    }

    /** Variante query param — pour encoder une URL complète (avec / et :) sans souci de path. */
    @GetMapping(value = "/qr", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getQrCodeByContent(
            @RequestParam String content,
            @RequestParam(defaultValue = "240") int size) {
        return buildQr(content, size);
    }

    private ResponseEntity<byte[]> buildQr(String content, int size) {
        try {
            byte[] png = qrCodeService.generatePng(content, size);
            return ResponseEntity.ok()
                .header("Cache-Control", "public, max-age=3600")
                .body(png);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @PostMapping
    public ResponseEntity<Ticket> createTicket(
            @RequestParam String registrationId,
            @RequestParam String eventId,
            @RequestParam String attendeeId) {
        Ticket ticket = ticketService.createTicket(registrationId, eventId, attendeeId);
        return new ResponseEntity<>(ticket, HttpStatus.CREATED);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Ticket> getTicketById(@PathVariable String id) {
        return ticketService.getTicketById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/event/{eventId}")
    public ResponseEntity<List<Ticket>> getTicketsByEvent(@PathVariable String eventId) {
        return ResponseEntity.ok(ticketService.getTicketsByEvent(eventId));
    }

    @GetMapping("/attendee/{attendeeId}")
    public ResponseEntity<List<Ticket>> getTicketsByAttendee(@PathVariable String attendeeId) {
        return ResponseEntity.ok(ticketService.getTicketsByAttendee(attendeeId));
    }

    @GetMapping("/registration/{registrationId}")
    public ResponseEntity<Ticket> getTicketByRegistration(@PathVariable String registrationId) {
        return ticketService.getTicketByRegistration(registrationId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/validate")
    public ResponseEntity<Ticket> validateTicket(@PathVariable String id) {
        try {
            Ticket validated = ticketService.validateTicket(id);
            return ResponseEntity.ok(validated);
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().build();
        }
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<Ticket> cancelTicket(@PathVariable String id) {
        try {
            Ticket cancelled = ticketService.cancelTicket(id);
            return ResponseEntity.ok(cancelled);
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}
