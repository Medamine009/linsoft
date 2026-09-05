package com.pfe.events.registrationservice.repositories;

import com.pfe.events.registrationservice.entities.Registration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.data.mongo.DataMongoTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.MongoDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Intégration MongoDB réelle (Testcontainers) pour les inscriptions.
 *
 * <p>Ce que des mocks ne peuvent pas prouver et qui est vérifié ici :</p>
 * <ul>
 *   <li>les requêtes dérivées et la {@code @Query} explicite {@code countCheckedIn}
 *       (nommée ainsi parce que « countByCheckedIn » serait interprété comme le
 *       mot-clé {@code In}) renvoient bien ce qu'on attend ;</li>
 *   <li>le mapping de l'entité survit à un aller-retour en base, y compris les
 *       {@code LocalDateTime} et les champs d'avancement/certificat ajoutés
 *       après coup.</li>
 * </ul>
 *
 * <p>Aucune base locale n'est requise : le conteneur est démarré et détruit par
 * le test.</p>
 */
@Testcontainers
@DataMongoTest
@EnabledIf("dockerAvailable")
class RegistrationRepositoryIT {

    /**
     * Ne s'exécute que si un démon Docker est réellement joignable.
     *
     * <p>En intégration continue (runner Linux, socket Unix standard) la
     * condition est vraie : ces tests s'exécutent pour de bon et le pipeline
     * échoue s'ils cassent. Sur un poste où Docker Desktop refuse l'accès au
     * socket aux clients Java, ils sont ignorés au lieu de faire échouer tout le
     * build sur un problème d'environnement — jamais pour masquer un échec.</p>
     */
    static boolean dockerAvailable() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            return false;
        }
    }

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer("mongo:6.0");

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.mongodb.uri", MONGO::getReplicaSetUrl);
        // Le service consomme normalement Config Server + Eureka : hors sujet ici.
        registry.add("spring.cloud.config.enabled", () -> "false");
        registry.add("eureka.client.enabled", () -> "false");
    }

    @Autowired RegistrationRepository repository;

    private Registration registration(String eventId, String attendeeId, String status, boolean checkedIn) {
        Registration r = new Registration();
        r.setEventId(eventId);
        r.setAttendeeId(attendeeId);
        r.setStatus(status);
        r.setCheckedIn(checkedIn);
        r.setEventTitle("Kubernetes Administrator (CKA)");
        r.setEventDateStr("2026-08-17T09:00");
        r.setEventDurationStr("4 jours");
        r.setAttendeeName("Yassine Gharbi");
        r.setAttendeeEmail("y.gharbi@linsoft.tn");
        return r;
    }

    @BeforeEach
    void resetCollection() {
        repository.deleteAll();
    }

    @Test
    void mongoContainerIsReachable() {
        assertTrue(MONGO.isRunning());
    }

    @Test
    void findByEventId_returnsOnlyThatSession() {
        repository.save(registration("ev-1", "u1", "CONFIRMED", true));
        repository.save(registration("ev-1", "u2", "CONFIRMED", false));
        repository.save(registration("ev-2", "u3", "CONFIRMED", true));

        assertEquals(2, repository.findByEventId("ev-1").size());
        assertEquals(1, repository.findByEventId("ev-2").size());
        assertTrue(repository.findByEventId("ev-inconnu").isEmpty());
    }

    @Test
    void findByAttendeeId_returnsTheWholeHistoryOfOneParticipant() {
        repository.save(registration("ev-1", "u1", "CONFIRMED", true));
        repository.save(registration("ev-2", "u1", "CANCELLED", false));
        repository.save(registration("ev-1", "u2", "CONFIRMED", true));

        List<Registration> history = repository.findByAttendeeId("u1");
        assertEquals(2, history.size());
        assertTrue(history.stream().allMatch(r -> "u1".equals(r.getAttendeeId())));
    }

    @Test
    void existsByEventIdAndAttendeeIdAndStatus_guardsAgainstDoubleRegistration() {
        repository.save(registration("ev-1", "u1", "CONFIRMED", false));

        assertTrue(repository.existsByEventIdAndAttendeeIdAndStatus("ev-1", "u1", "CONFIRMED"));
        assertFalse(repository.existsByEventIdAndAttendeeIdAndStatus("ev-1", "u1", "PENDING"));
        assertFalse(repository.existsByEventIdAndAttendeeIdAndStatus("ev-2", "u1", "CONFIRMED"));
    }

    @Test
    void countByStatus_andCountCheckedIn_agreeWithTheData() {
        repository.save(registration("ev-1", "u1", "CONFIRMED", true));
        repository.save(registration("ev-1", "u2", "CONFIRMED", true));
        repository.save(registration("ev-1", "u3", "CONFIRMED", false));
        repository.save(registration("ev-1", "u4", "CANCELLED", false));

        assertEquals(3, repository.countByStatus("CONFIRMED"));
        assertEquals(1, repository.countByStatus("CANCELLED"));
        // Requête @Query explicite : c'est précisément ce qu'un mock ne teste pas.
        assertEquals(2, repository.countCheckedIn(true));
        assertEquals(2, repository.countCheckedIn(false));
    }

    @Test
    void findByStatus_feedsTheValidationQueue() {
        repository.save(registration("ev-1", "u1", "PENDING", false));
        repository.save(registration("ev-2", "u2", "PENDING", false));
        repository.save(registration("ev-1", "u3", "CONFIRMED", true));

        assertEquals(2, repository.findByStatus("PENDING").size());
    }

    @Test
    void progressAndCertificateFieldsSurviveARoundTrip() {
        Registration r = registration("ev-1", "u1", "CONFIRMED", true);
        LocalDateTime completedAt = LocalDateTime.of(2026, 8, 21, 9, 0);
        LocalDateTime sentAt = LocalDateTime.of(2026, 8, 24, 10, 23);
        r.setProgressStatus("COMPLETED");
        r.setProgressPercent(100);
        r.setCompletedAt(completedAt);
        r.setCompletionNotified(true);
        r.setCertificateStatus("SENT");
        r.setCertificateSentAt(sentAt);
        r.setCertificateHandledBy("Sonia Ben Amor");
        r.setCheckedInAt(LocalDateTime.of(2026, 8, 17, 8, 52));

        String id = repository.save(r).getId();
        Registration reloaded = repository.findById(id).orElseThrow();

        assertEquals("COMPLETED", reloaded.getProgressStatus());
        assertEquals(100, reloaded.getProgressPercent());
        assertEquals(completedAt, reloaded.getCompletedAt());
        assertTrue(reloaded.isCompletionNotified());
        assertEquals("SENT", reloaded.getCertificateStatus());
        assertEquals(sentAt, reloaded.getCertificateSentAt());
        assertEquals("Sonia Ben Amor", reloaded.getCertificateHandledBy());
        assertEquals("4 jours", reloaded.getEventDurationStr());
        assertEquals("y.gharbi@linsoft.tn", reloaded.getAttendeeEmail());
    }

    @Test
    void newRegistrationCarriesTheDefaultWorkflowState() {
        // Les valeurs par défaut du constructeur doivent bien atterrir en base :
        // c'est ce qui distingue une inscription récente d'une fiche héritée
        // (progressStatus null) que le service doit compléter.
        String id = repository.save(registration("ev-1", "u1", "CONFIRMED", false)).getId();

        Registration reloaded = repository.findById(id).orElseThrow();
        assertEquals("NOT_STARTED", reloaded.getProgressStatus());
        assertEquals("NOT_AVAILABLE", reloaded.getCertificateStatus());
        assertNotNull(reloaded.getRegistrationDate());
    }
}
