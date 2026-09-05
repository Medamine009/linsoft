package com.pfe.events.notificationservice.repositories;

import com.pfe.events.notificationservice.entities.InAppMessage;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

public interface InAppMessageRepository extends MongoRepository<InAppMessage, String> {

    /** Messages d'un destinataire, du plus récent au plus ancien (email insensible à la casse). */
    List<InAppMessage> findByRecipientEmailIgnoreCaseOrderByCreatedAtDesc(String recipientEmail);
}
