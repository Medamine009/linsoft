package com.pfe.events.notificationservice.dto;

/**
 * Payload publié par les autres microservices sur RabbitMQ.
 * type :
 *   - REGISTRATION_CONFIRMED
 *   - REGISTRATION_CANCELLED
 *   - EVENT_PUBLISHED
 *   - EVENT_REMINDER
 */
public class NotificationEvent {

    private String type;
    private String email;
    private String firstName;
    private String eventTitle;
    private String eventDate;
    private String eventLocation;
    private String registrationId;

    public NotificationEvent() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getFirstName() { return firstName; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public String getEventTitle() { return eventTitle; }
    public void setEventTitle(String eventTitle) { this.eventTitle = eventTitle; }
    public String getEventDate() { return eventDate; }
    public void setEventDate(String eventDate) { this.eventDate = eventDate; }
    public String getEventLocation() { return eventLocation; }
    public void setEventLocation(String eventLocation) { this.eventLocation = eventLocation; }
    public String getRegistrationId() { return registrationId; }
    public void setRegistrationId(String registrationId) { this.registrationId = registrationId; }
}
