package com.pfe.events.feedbackservice.entities;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.LocalDateTime;

@Document(collection = "feedbacks")
public class Feedback {

    @Id
    private String id;

    private String eventId;
    private String userId;
    /**
     * Nom lisible de l'auteur, recopié depuis le jeton à la création.
     *
     * <p>Dénormalisé comme {@code attendeeName} l'est sur une inscription :
     * afficher une liste d'avis ne doit pas obliger à interroger le service
     * utilisateur pour chaque ligne. Sans ce champ, l'interface n'avait que
     * l'identifiant Keycloak à montrer.</p>
     */
    private String userName;
    private int rating; // 1 to 5
    private String comment;
    private LocalDateTime createdAt;

    public Feedback() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getEventId() { return eventId; }
    public void setEventId(String eventId) { this.eventId = eventId; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public int getRating() { return rating; }
    public void setRating(int rating) { this.rating = rating; }

    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
