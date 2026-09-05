package com.pfe.events.notificationservice.entities;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

/**
 * Message in-app livré à un destinataire (ex : diffusion admin → participants).
 * Permet au destinataire de le retrouver dans ses notifications, pas seulement par email.
 */
@Document(collection = "inapp_messages")
public class InAppMessage {

    @Id
    private String id;
    private String recipientEmail;
    private String subject;
    private String message;
    private String senderRole;   // rôle de l'expéditeur (ex : ADMIN)
    private boolean read = false;
    private LocalDateTime createdAt = LocalDateTime.now();

    public InAppMessage() {}

    public InAppMessage(String recipientEmail, String subject, String message, String senderRole) {
        this.recipientEmail = recipientEmail;
        this.subject = subject;
        this.message = message;
        this.senderRole = senderRole;
        this.createdAt = LocalDateTime.now();
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getRecipientEmail() { return recipientEmail; }
    public void setRecipientEmail(String recipientEmail) { this.recipientEmail = recipientEmail; }
    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getSenderRole() { return senderRole; }
    public void setSenderRole(String senderRole) { this.senderRole = senderRole; }
    public boolean isRead() { return read; }
    public void setRead(boolean read) { this.read = read; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
