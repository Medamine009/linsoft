package com.pfe.events.registrationservice.entities;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "registrations")
public class Registration {

    @Id
    private String id;
    
    // ID de l'événement (provenant du Event-Service)
    private String eventId;
    
    // ID du participant (provenant du User-Service / Keycloak)
    private String attendeeId;
    
    private LocalDateTime registrationDate;
    
    private String status; // CONFIRMED, CANCELLED, PENDING

    // Un simple hash ou string pour représenter le QR Code pour le moment
    private String qrCodeTicket;

    // Check-in le jour J (scan du QR à l'entrée)
    private boolean checkedIn;
    private LocalDateTime checkedInAt;

    // Type de billet choisi (VIP, Standard…) + son prix
    private String ticketType;
    private Double ticketPrice;

    // Rappel automatique déjà envoyé (évite les doublons)
    private boolean reminderSent;

    // Champs dénormalisés pour la page publique de vérification (évite les appels inter-services authentifiés)
    private String eventTitle;
    private String eventLocation;
    private String eventDateStr;
    private String attendeeName;

    // Contact du participant, dénormalisé : les notifications de clôture partent
    // d'un planificateur, sans jeton pour interroger le user-service.
    private String attendeeEmail;
    private String attendeeFirstName;

    // Durée libellée de la session ("3 jours", "4 heures"…) — sert à calculer la
    // fin de session, donc l'avancement du participant et la clôture automatique.
    private String eventDurationStr;

    // ─── Avancement du participant dans la session ───
    // NOT_STARTED (inscrit, session à venir) | IN_PROGRESS (session en cours)
    // | COMPLETED (session terminée) | CANCELLED (inscription annulée ou refusée)
    private String progressStatus;
    private int progressPercent;
    private LocalDateTime completedAt;
    // Le participant a déjà été prévenu de la clôture (évite les doublons d'email)
    private boolean completionNotified;

    // ─── Certificat de participation ───
    // NOT_AVAILABLE     : la session n'est pas terminée
    // IN_PREPARATION    : session terminée, certificat en cours de préparation
    // PENDING_APPROVAL  : l'administrateur a différé l'envoi (à traiter plus tard)
    // SENT              : envoyé par l'administrateur — téléchargeable par le participant
    private String certificateStatus;
    private LocalDateTime certificateSentAt;
    private String certificateHandledBy;   // administrateur ayant tranché

    public Registration() {
        this.registrationDate = LocalDateTime.now();
        this.status = "CONFIRMED";
        this.progressStatus = "NOT_STARTED";
        this.certificateStatus = "NOT_AVAILABLE";
    }

    public String getAttendeeEmail() { return attendeeEmail; }
    public void setAttendeeEmail(String attendeeEmail) { this.attendeeEmail = attendeeEmail; }

    public String getAttendeeFirstName() { return attendeeFirstName; }
    public void setAttendeeFirstName(String attendeeFirstName) { this.attendeeFirstName = attendeeFirstName; }

    public String getEventDurationStr() { return eventDurationStr; }
    public void setEventDurationStr(String eventDurationStr) { this.eventDurationStr = eventDurationStr; }

    public String getProgressStatus() { return progressStatus; }
    public void setProgressStatus(String progressStatus) { this.progressStatus = progressStatus; }

    public int getProgressPercent() { return progressPercent; }
    public void setProgressPercent(int progressPercent) { this.progressPercent = progressPercent; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public boolean isCompletionNotified() { return completionNotified; }
    public void setCompletionNotified(boolean completionNotified) { this.completionNotified = completionNotified; }

    public String getCertificateStatus() { return certificateStatus; }
    public void setCertificateStatus(String certificateStatus) { this.certificateStatus = certificateStatus; }

    public LocalDateTime getCertificateSentAt() { return certificateSentAt; }
    public void setCertificateSentAt(LocalDateTime certificateSentAt) { this.certificateSentAt = certificateSentAt; }

    public String getCertificateHandledBy() { return certificateHandledBy; }
    public void setCertificateHandledBy(String certificateHandledBy) { this.certificateHandledBy = certificateHandledBy; }

    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
    public String getEventLocation() { return eventLocation; }
    public void setEventLocation(String eventLocation) { this.eventLocation = eventLocation; }
    public String getEventDateStr() { return eventDateStr; }
    public void setEventDateStr(String eventDateStr) { this.eventDateStr = eventDateStr; }
    public String getAttendeeName() { return attendeeName; }
    public void setAttendeeName(String attendeeName) { this.attendeeName = attendeeName; }

    // Getters and Setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public String getAttendeeId() {
        return attendeeId;
    }

    public void setAttendeeId(String attendeeId) {
        this.attendeeId = attendeeId;
    }

    public LocalDateTime getRegistrationDate() {
        return registrationDate;
    }

    public void setRegistrationDate(LocalDateTime registrationDate) {
        this.registrationDate = registrationDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getQrCodeTicket() {
        return qrCodeTicket;
    }

    public void setQrCodeTicket(String qrCodeTicket) {
        this.qrCodeTicket = qrCodeTicket;
    }

    public boolean isCheckedIn() {
        return checkedIn;
    }

    public void setCheckedIn(boolean checkedIn) {
        this.checkedIn = checkedIn;
    }

    public LocalDateTime getCheckedInAt() {
        return checkedInAt;
    }

    public void setCheckedInAt(LocalDateTime checkedInAt) {
        this.checkedInAt = checkedInAt;
    }

    public String getTicketType() {
        return ticketType;
    }

    public void setTicketType(String ticketType) {
        this.ticketType = ticketType;
    }

    public Double getTicketPrice() {
        return ticketPrice;
    }

    public void setTicketPrice(Double ticketPrice) {
        this.ticketPrice = ticketPrice;
    }

    public boolean isReminderSent() {
        return reminderSent;
    }

    public void setReminderSent(boolean reminderSent) {
        this.reminderSent = reminderSent;
    }
}
