package com.pfe.events.eventservice.entities;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "events")
public class Event {

    /** Type de billet (VIP, Standard, Early Bird…) avec son prix et son quota. */
    public static class TicketType {
        private String name;
        private Double price;
        private Integer quota;

        public TicketType() {}
        public TicketType(String name, Double price, Integer quota) {
            this.name = name; this.price = price; this.quota = quota;
        }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public Double getPrice() { return price; }
        public void setPrice(Double price) { this.price = price; }
        public Integer getQuota() { return quota; }
        public void setQuota(Integer quota) { this.quota = quota; }
    }

    /**
     * Demande de l'organisateur en attente de décision de l'administrateur :
     * soit une modification (les champs proposés sont portés ici, l'événement
     * publié reste inchangé jusqu'à l'approbation), soit une annulation motivée.
     */
    public static class PendingChange {
        private String type;               // UPDATE | CANCEL
        private String reason;             // motif — obligatoire pour une annulation
        private String requestedBy;        // organizerId à l'origine de la demande
        private String requestedByName;
        private LocalDateTime requestedAt;

        // Valeurs proposées (UPDATE) — un champ null signifie « inchangé »
        private String title;
        private String description;
        private LocalDateTime eventDate;
        private String location;
        private String category;
        private String mode;
        private String visioLink;
        private Integer totalSeats;
        private String level;
        private String duration;
        private String prerequisites;
        private String speaker;
        private String certification;
        private Double latitude;
        private Double longitude;

        public PendingChange() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public String getRequestedBy() { return requestedBy; }
        public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
        public String getRequestedByName() { return requestedByName; }
        public void setRequestedByName(String requestedByName) { this.requestedByName = requestedByName; }
        public LocalDateTime getRequestedAt() { return requestedAt; }
        public void setRequestedAt(LocalDateTime requestedAt) { this.requestedAt = requestedAt; }
        public String getTitle() { return title; }
        public void setTitle(String title) { this.title = title; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public LocalDateTime getEventDate() { return eventDate; }
        public void setEventDate(LocalDateTime eventDate) { this.eventDate = eventDate; }
        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }
        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public String getMode() { return mode; }
        public void setMode(String mode) { this.mode = mode; }
        public String getVisioLink() { return visioLink; }
        public void setVisioLink(String visioLink) { this.visioLink = visioLink; }
        public Integer getTotalSeats() { return totalSeats; }
        public void setTotalSeats(Integer totalSeats) { this.totalSeats = totalSeats; }
        public String getLevel() { return level; }
        public void setLevel(String level) { this.level = level; }
        public String getDuration() { return duration; }
        public void setDuration(String duration) { this.duration = duration; }
        public String getPrerequisites() { return prerequisites; }
        public void setPrerequisites(String prerequisites) { this.prerequisites = prerequisites; }
        public String getSpeaker() { return speaker; }
        public void setSpeaker(String speaker) { this.speaker = speaker; }
        public String getCertification() { return certification; }
        public void setCertification(String certification) { this.certification = certification; }
        public Double getLatitude() { return latitude; }
        public void setLatitude(Double latitude) { this.latitude = latitude; }
        public Double getLongitude() { return longitude; }
        public void setLongitude(Double longitude) { this.longitude = longitude; }
    }

    /**
     * Issue de la dernière demande tranchée par l'administrateur.
     * Sans elle, un refus effacerait simplement la demande : l'organisateur ne
     * pourrait pas distinguer « refusée » de « jamais envoyée ».
     */
    public static class ChangeDecision {
        private String type;        // UPDATE | CANCEL — nature de la demande jugée
        private String outcome;     // APPROVED | REJECTED
        private String reason;      // motif que portait la demande
        private LocalDateTime decidedAt;

        public ChangeDecision() {}

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public String getOutcome() { return outcome; }
        public void setOutcome(String outcome) { this.outcome = outcome; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public LocalDateTime getDecidedAt() { return decidedAt; }
        public void setDecidedAt(LocalDateTime decidedAt) { this.decidedAt = decidedAt; }
    }

    @Id
    private String id;
    private String title;
    private String description;
    private LocalDateTime eventDate;
    private String location;
    
    // Rôle "Organisateur" provenant du User-Service / Keycloak
    private String organizerId;
    // Contact organisateur (dénormalisé) — sert à l'envoi de la notification de création
    private String organizerEmail;
    private String organizerName;
    
    private String category;
    private Double price;
    private Integer totalSeats;
    private Integer availableSeats;

    // Modération : PENDING (en attente) | APPROVED (publié) | REJECTED (refusé)
    //            | CANCELLED (annulée par l'organisateur, annulation approuvée)
    // null = événement hérité (avant la modération) → considéré comme publié
    private String status;

    // Demande de modification ou d'annulation en attente de décision admin.
    // null = aucune demande en cours.
    private PendingChange pendingChange;

    // Motif conservé après l'approbation d'une annulation (affiché aux participants).
    private String cancelReason;

    // Issue de la dernière demande tranchée, jusqu'à ce que l'organisateur en prenne acte.
    private ChangeDecision lastChangeDecision;

    // Types de billets (VIP, Standard…). Vide = billet unique au prix `price`.
    private List<TicketType> ticketTypes;

    // Nature de la publication : EVENEMENT (par défaut) ou FORMATION
    private String type;

    // Format : PRESENTIEL (défaut) | EN_LIGNE | HYBRIDE
    private String mode;

    // Lien de visioconférence (pour les sessions en ligne / hybrides)
    private String visioLink;

    // ─── Champs spécifiques par type de session ───
    // type ∈ FORMATION | WORKSHOP | CONFERENCE (| EVENEMENT hérité)
    private String level;          // Niveau : Débutant | Intermédiaire | Avancé (Formation, Workshop)
    private String duration;       // Durée libellée : "3 jours" / "4 heures" (Formation, Workshop)
    private String prerequisites;  // Prérequis (Formation, Workshop)
    private String speaker;        // Intervenant(s) (Conférence)
    private String certification;  // Certification visée (Formation)

    // Coordonnées géographiques (pin sur la carte)
    private Double latitude;
    private Double longitude;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public Double getLatitude() { return latitude; }
    public void setLatitude(Double latitude) { this.latitude = latitude; }
    public Double getLongitude() { return longitude; }
    public void setLongitude(Double longitude) { this.longitude = longitude; }

    public PendingChange getPendingChange() { return pendingChange; }
    public void setPendingChange(PendingChange pendingChange) { this.pendingChange = pendingChange; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String cancelReason) { this.cancelReason = cancelReason; }
    public ChangeDecision getLastChangeDecision() { return lastChangeDecision; }
    public void setLastChangeDecision(ChangeDecision lastChangeDecision) { this.lastChangeDecision = lastChangeDecision; }

    public Event() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    // Getters and Setters

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getEventDate() {
        return eventDate;
    }

    public void setEventDate(LocalDateTime eventDate) {
        this.eventDate = eventDate;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getOrganizerId() {
        return organizerId;
    }

    public void setOrganizerId(String organizerId) {
        this.organizerId = organizerId;
    }

    public String getOrganizerEmail() { return organizerEmail; }
    public void setOrganizerEmail(String organizerEmail) { this.organizerEmail = organizerEmail; }

    public String getOrganizerName() { return organizerName; }
    public void setOrganizerName(String organizerName) { this.organizerName = organizerName; }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Double getPrice() {
        return price;
    }

    public void setPrice(Double price) {
        this.price = price;
    }

    public Integer getTotalSeats() {
        return totalSeats;
    }

    public void setTotalSeats(Integer totalSeats) {
        this.totalSeats = totalSeats;
        if (this.availableSeats == null) {
            this.availableSeats = totalSeats;
        }
    }

    public Integer getAvailableSeats() {
        return availableSeats;
    }

    public void setAvailableSeats(Integer availableSeats) {
        this.availableSeats = availableSeats;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public List<TicketType> getTicketTypes() {
        return ticketTypes;
    }

    public void setTicketTypes(List<TicketType> ticketTypes) {
        this.ticketTypes = ticketTypes;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public String getVisioLink() {
        return visioLink;
    }

    public void setVisioLink(String visioLink) {
        this.visioLink = visioLink;
    }

    public String getLevel() { return level; }
    public void setLevel(String level) { this.level = level; }

    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }

    public String getPrerequisites() { return prerequisites; }
    public void setPrerequisites(String prerequisites) { this.prerequisites = prerequisites; }

    public String getSpeaker() { return speaker; }
    public void setSpeaker(String speaker) { this.speaker = speaker; }

    public String getCertification() { return certification; }
    public void setCertification(String certification) { this.certification = certification; }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
