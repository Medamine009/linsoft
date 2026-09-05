package com.pfe.events.registrationservice.repositories;

import com.pfe.events.registrationservice.entities.Registration;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RegistrationRepository extends MongoRepository<Registration, String> {
    List<Registration> findByEventId(String eventId);
    List<Registration> findByAttendeeId(String attendeeId);
    List<Registration> findByStatus(String status);
    boolean existsByEventIdAndAttendeeIdAndStatus(String eventId, String attendeeId, String status);
    long countByStatus(String status);

    // NB : « countByCheckedIn » serait mal interprété (mot-clé IN) → requête explicite.
    @Query(value = "{ 'checkedIn': ?0 }", count = true)
    long countCheckedIn(boolean checkedIn);
}
