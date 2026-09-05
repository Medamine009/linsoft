package com.pfe.events.eventservice.services;

import com.pfe.events.eventservice.entities.Event;
import com.pfe.events.eventservice.repositories.EventRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class EventService {

    @Autowired
    private EventRepository eventRepository;

    @Autowired
    private NotificationPublisher notificationPublisher;

    /** Création par un organisateur : la session passe par la modération. */
    public Event createEvent(Event event) {
        return createEvent(event, false);
    }

    /**
     * @param autoApprove vrai lorsque l'auteur est administrateur. L'admin étant
     *                    lui-même l'autorité de modération, sa session est publiée
     *                    d'emblée : la faire transiter par sa propre file d'attente
     *                    n'aurait aucun sens.
     */
    public Event createEvent(Event event, boolean autoApprove) {
        // Si des types de billets sont définis : la capacité = somme des quotas,
        // et le prix affiché = le plus bas des types (« à partir de … »).
        applyTicketTypes(event);
        event.setAvailableSeats(event.getTotalSeats()); // initialiser les places dispo
        // Le statut découle du rôle de l'auteur, jamais de la charge utile reçue :
        // sans cela, un organisateur pourrait publier sans passer par la modération.
        event.setStatus(autoApprove ? "APPROVED" : "PENDING");
        Event saved = eventRepository.save(event);
        // Notifie l'organisateur/formateur : session soumise, ou déjà en ligne.
        if (autoApprove) {
            notificationPublisher.publishEventPublished(saved);
        } else {
            notificationPublisher.publishEventSubmitted(saved);
        }
        return saved;
    }

    /** Aligne totalSeats / price sur les types de billets s'il y en a. */
    private void applyTicketTypes(Event event) {
        List<Event.TicketType> types = event.getTicketTypes();
        if (types == null || types.isEmpty()) return;
        int totalQuota = 0;
        Double minPrice = null;
        for (Event.TicketType t : types) {
            if (t.getQuota() != null) totalQuota += t.getQuota();
            if (t.getPrice() != null && (minPrice == null || t.getPrice() < minPrice)) minPrice = t.getPrice();
        }
        if (totalQuota > 0) event.setTotalSeats(totalQuota);
        if (minPrice != null) event.setPrice(minPrice);
    }

    public List<Event> getAllEvents() {
        return eventRepository.findAll();
    }

    /** Événements publiés (visibles par les participants) : APPROVED ou hérités (status null). */
    public List<Event> getPublishedEvents() {
        return eventRepository.findAll().stream()
                .filter(e -> e.getStatus() == null || "APPROVED".equalsIgnoreCase(e.getStatus()))
                .collect(Collectors.toList());
    }

    /** Filtre les événements par statut de modération (PENDING, APPROVED, REJECTED). */
    public List<Event> getEventsByStatus(String status) {
        return eventRepository.findAll().stream()
                .filter(e -> status != null && status.equalsIgnoreCase(e.getStatus()))
                .collect(Collectors.toList());
    }

    /** Approuve / refuse un événement (modération admin). */
    public Event updateStatus(String id, String status) {
        return eventRepository.findById(id).map(event -> {
            event.setStatus(status);
            event.setUpdatedAt(LocalDateTime.now());
            return eventRepository.save(event);
        }).orElseThrow(() -> new RuntimeException("Event not found with id " + id));
    }

    public Optional<Event> getEventById(String id) {
        return eventRepository.findById(id);
    }

    public List<Event> getEventsByCategory(String category) {
        return eventRepository.findByCategory(category);
    }

    public List<Event> getEventsByOrganizer(String organizerId) {
        return eventRepository.findByOrganizerId(organizerId);
    }

    public Event updateEvent(String id, Event updatedEvent) {
        return eventRepository.findById(id).map(event -> {
            event.setTitle(updatedEvent.getTitle());
            event.setDescription(updatedEvent.getDescription());
            event.setEventDate(updatedEvent.getEventDate());
            event.setLocation(updatedEvent.getLocation());
            event.setCategory(updatedEvent.getCategory());
            event.setPrice(updatedEvent.getPrice());
            if (updatedEvent.getTicketTypes() != null) event.setTicketTypes(updatedEvent.getTicketTypes());
            if (updatedEvent.getType() != null) event.setType(updatedEvent.getType());
            if (updatedEvent.getMode() != null) event.setMode(updatedEvent.getMode());
            if (updatedEvent.getVisioLink() != null) event.setVisioLink(updatedEvent.getVisioLink());
            if (updatedEvent.getLevel() != null) event.setLevel(updatedEvent.getLevel());
            if (updatedEvent.getDuration() != null) event.setDuration(updatedEvent.getDuration());
            if (updatedEvent.getPrerequisites() != null) event.setPrerequisites(updatedEvent.getPrerequisites());
            if (updatedEvent.getSpeaker() != null) event.setSpeaker(updatedEvent.getSpeaker());
            if (updatedEvent.getCertification() != null) event.setCertification(updatedEvent.getCertification());
            if (updatedEvent.getLatitude() != null) event.setLatitude(updatedEvent.getLatitude());
            if (updatedEvent.getLongitude() != null) event.setLongitude(updatedEvent.getLongitude());
            
            // Si le nombre total de places a changé, ajuster dispo (logique basique, à améliorer)
            if (!event.getTotalSeats().equals(updatedEvent.getTotalSeats())) {
                int diff = updatedEvent.getTotalSeats() - event.getTotalSeats();
                event.setTotalSeats(updatedEvent.getTotalSeats());
                event.setAvailableSeats(event.getAvailableSeats() + diff);
            }
            
            event.setUpdatedAt(LocalDateTime.now());
            return eventRepository.save(event);
        }).orElseThrow(() -> new RuntimeException("Event not found with id " + id));
    }

    public void deleteEvent(String id) {
        eventRepository.deleteById(id);
    }

    /** Ajuste availableSeats avec un delta (-1 pour inscription, +1 pour annulation). */
    public Event adjustAvailableSeats(String id, int delta) {
        return eventRepository.findById(id).map(event -> {
            int current = event.getAvailableSeats() == null ? event.getTotalSeats() : event.getAvailableSeats();
            int total = event.getTotalSeats() == null ? 0 : event.getTotalSeats();
            int next = current + delta;
            if (next < 0) next = 0;
            if (next > total) next = total;
            event.setAvailableSeats(next);
            event.setUpdatedAt(LocalDateTime.now());
            return eventRepository.save(event);
        }).orElseThrow(() -> new RuntimeException("Event not found with id " + id));
    }

    /** Statistiques du catalogue (pour le tableau de bord analytique). */
    public Map<String, Object> stats() {
        List<Event> all = eventRepository.findAll();
        long published = all.stream().filter(e -> e.getStatus() == null || "APPROVED".equalsIgnoreCase(e.getStatus())).count();
        long pending = all.stream().filter(e -> "PENDING".equalsIgnoreCase(e.getStatus())).count();
        long rejected = all.stream().filter(e -> "REJECTED".equalsIgnoreCase(e.getStatus())).count();
        int totalSeats = all.stream().mapToInt(e -> e.getTotalSeats() == null ? 0 : e.getTotalSeats()).sum();
        int availableSeats = all.stream().mapToInt(e -> e.getAvailableSeats() == null ? 0 : e.getAvailableSeats()).sum();

        Map<String, Object> m = new HashMap<>();
        m.put("total", all.size());
        m.put("published", published);
        m.put("pending", pending);
        m.put("rejected", rejected);
        m.put("totalSeats", totalSeats);
        m.put("reservedSeats", totalSeats - availableSeats);
        m.put("byCategory", countBy(all, Event::getCategory));
        m.put("byType", countBy(all, Event::getType));
        m.put("byMode", countBy(all, Event::getMode));
        return m;
    }

    private Map<String, Long> countBy(List<Event> all, Function<Event, String> extractor) {
        return all.stream()
                .map(e -> { String v = extractor.apply(e); return (v == null || v.isBlank()) ? "(non défini)" : v; })
                .collect(Collectors.groupingBy(x -> x, Collectors.counting()));
    }
}
