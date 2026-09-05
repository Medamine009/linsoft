import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // Dev local (npm start sur 4200) -> gateway absolu localhost:8080
  // Prod (servi par nginx) -> /api proxie vers le gateway dans le cluster
  private apiUrl =
    typeof window !== 'undefined'
    && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    && window.location.port === '4200'
      ? 'http://localhost:8080/api'
      : '/api';

  constructor(private http: HttpClient) {}

  // ========== USERS ENDPOINTS ==========
  getMe(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/me`);
  }

  becomeOrganizer(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/me/become-organizer`, {});
  }

  /** Ferme toutes les sessions Keycloak du compte courant (tous appareils). */
  logoutAllDevices(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/me/logout-all`, {});
  }

  /** Désactive le compte courant : plus aucune connexion possible. */
  disableMyAccount(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users/me/disable`, {});
  }

  /** Active / désactive un compte (administration). */
  setUserEnabled(keycloakId: string, enabled: boolean): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/keycloak/${keycloakId}/enabled?value=${enabled}`, {});
  }

  getAllRegistrations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registrations`);
  }

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  getUserById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/${id}`);
  }

  getUserByKeycloakId(keycloakId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/users/keycloak/${keycloakId}`);
  }

  createUser(user: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/users`, user);
  }

  updateUser(keycloakId: string, user: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/keycloak/${keycloakId}`, user);
  }

  deleteUser(keycloakId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/keycloak/${keycloakId}`);
  }

  /** Admin : attribue un rôle (PARTICIPANT / ORGANISATEUR / ADMIN) à un collaborateur. */
  assignRole(keycloakId: string, role: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/keycloak/${keycloakId}/assign-role?role=${role}`, {});
  }

  // ========== EVENTS ENDPOINTS ==========
  getAllEvents(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/events`);
  }

  /** Événements approuvés uniquement (vue participant). */
  getPublishedEvents(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/events/published`);
  }

  /** Événements filtrés par statut de modération (PENDING, APPROVED, REJECTED). */
  getEventsByStatus(status: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/events/status/${status}`);
  }

  /** Approuver / refuser un événement (admin). */
  updateEventStatus(id: string, status: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/status?status=${status}`, {});
  }

  // ─── Demandes de l'organisateur sur une session publiée ───

  /** Propose une modification : la session ne change qu'après approbation admin. */
  requestEventUpdate(id: string, proposed: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/request-update`, proposed);
  }

  /** Demande l'annulation d'une session, motif à l'appui. */
  requestEventCancel(id: string, reason: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/request-cancel`, { reason });
  }

  /** Retire une demande encore en attente. */
  withdrawEventChange(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/withdraw-change`, {});
  }

  /** File des demandes à trancher (admin). */
  getPendingEventChanges(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/events/changes/pending`);
  }

  /** Applique la demande et prévient les inscrits (admin). */
  approveEventChange(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/change/approve`, {});
  }

  /** Refuse la demande : la session reste en l'état (admin). */
  rejectEventChange(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/change/reject`, {});
  }

  /** L'organisateur prend acte de l'issue de sa demande : l'avis disparaît. */
  ackEventDecision(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}/ack-decision`, {});
  }

  getEventById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/events/${id}`);
  }

  getEventsByCategory(category: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/events/category/${category}`);
  }

  getEventsByOrganizer(organizerId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/events/organizer/${organizerId}`);
  }

  createEvent(event: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/events`, event);
  }

  updateEvent(id: string, event: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/events/${id}`, event);
  }

  deleteEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/events/${id}`);
  }

  // ========== REGISTRATIONS ENDPOINTS ==========
  getRegistrationById(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/registrations/${id}`);
  }

  getRegistrationsByEvent(eventId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registrations/event/${eventId}`);
  }

  getRegistrationsByAttendee(attendeeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registrations/attendee/${attendeeId}`);
  }

  registerForEvent(eventId: string, attendeeId: string, ticketType?: string, ticketPrice?: number): Observable<any> {
    let url = `${this.apiUrl}/registrations/event/${eventId}/attendee/${attendeeId}`;
    const params: string[] = [];
    if (ticketType) params.push(`ticketType=${encodeURIComponent(ticketType)}`);
    if (ticketPrice != null) params.push(`ticketPrice=${ticketPrice}`);
    if (params.length) url += `?${params.join('&')}`;
    return this.http.post<any>(url, {});
  }

  cancelRegistration(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${id}/cancel`, {});
  }

  /** Vérification publique d'un billet (renvoie aussi le statut de check-in). */
  verifyRegistration(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/registrations/${id}/verify`);
  }

  /** Check-in le jour J : valide le billet à l'entrée. Renvoie { result: OK|ALREADY|INVALID }. */
  checkInRegistration(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${id}/checkin`, {});
  }

  /** Annule un check-in (erreur de scan). */
  undoCheckIn(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${id}/checkin/undo`, {});
  }

  // ========== FEEDBACK ==========
  getFeedbacksByEvent(eventId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/feedback/event/${eventId}`);
  }

  getFeedbacksByUser(userId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/feedback/user/${userId}`);
  }

  getAverageRating(eventId: string): Observable<{ averageRating: number }> {
    return this.http.get<{ averageRating: number }>(`${this.apiUrl}/feedback/event/${eventId}/average`);
  }

  createFeedback(feedback: { eventId: string; userId: string; rating: number; comment: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/feedback`, feedback);
  }

  deleteFeedback(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/feedback/${id}`);
  }

  // ========== QR CODES ==========
  getQrCodeUrl(data: string, size = 240): string {
    return `${this.apiUrl}/tickets/qr/${encodeURIComponent(data)}?size=${size}`;
  }

  /** Récupère le QR en blob. Le contenu (URL) passe en query param pour éviter les soucis de path. */
  getQrCodeBlob(content: string, size = 240): Observable<Blob> {
    const params = new URLSearchParams({ content, size: String(size) });
    return this.http.get(`${this.apiUrl}/tickets/qr?${params.toString()}`, {
      responseType: 'blob'
    });
  }

  // ========== USER PROFILE ==========
  updateMyProfile(profile: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/users/keycloak/${profile.keycloakId}`, profile);
  }

  // ========== ASSISTANT IA (chatbot) ==========
  /** Envoie un message à notre API IA (/api/ai/chat, moteur Gemini). */
  chatWithAi(
    message: string,
    history: { role: string; content: string }[] = []
  ): Observable<{ reply: string; model: string }> {
    return this.http.post<{ reply: string; model: string }>(`${this.apiUrl}/ai/chat`, { message, history });
  }

  /** Analyse de sentiment + synthèse IA des avis d'un événement. */
  analyzeFeedback(eventId: string): Observable<{ count: number; analysis: string; model?: string }> {
    return this.http.post<{ count: number; analysis: string; model?: string }>(
      `${this.apiUrl}/ai/feedback-analysis`, { eventId });
  }

  // ========== SUIVI DE PARTICIPATION ==========
  /**
   * Inscriptions du participant enrichies de son avancement : jalons du parcours,
   * fin de session calculée et état du certificat.
   */
  getAttendeeTracking(attendeeId: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registrations/attendee/${attendeeId}/tracking`);
  }

  // ========== CERTIFICAT PDF ==========
  /** Télécharge le certificat de participation (PDF) d'une inscription confirmée. */
  downloadCertificate(registrationId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/registrations/${registrationId}/certificate`, { responseType: 'blob' });
  }

  // ========== GESTION DES CERTIFICATS (admin) ==========
  /** File des certificats à traiter : sessions terminées, en préparation ou différées. */
  getPendingCertificates(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registrations/certificates/pending`);
  }

  /** Envoie le certificat au participant : il devient téléchargeable. */
  sendCertificate(registrationId: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${registrationId}/certificate/send`, {});
  }

  /** Diffère l'envoi : le certificat reste dans la file de l'administrateur. */
  holdCertificate(registrationId: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${registrationId}/certificate/hold`, {});
  }

  /** Envoi groupé des certificats d'une session terminée. */
  sendCertificatesForEvent(eventId: string): Observable<{ eventId: string; sent: number }> {
    return this.http.post<{ eventId: string; sent: number }>(
      `${this.apiUrl}/registrations/certificates/event/${eventId}/send-all`, {});
  }

  // ========== VALIDATION MANAGER ==========
  getPendingRegistrations(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/registrations/pending`);
  }
  approveRegistration(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${id}/approve`, {});
  }
  rejectRegistration(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/registrations/${id}/reject`, {});
  }
  requestRegistrationApproval(eventId: string, attendeeId: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/registrations/event/${eventId}/attendee/${attendeeId}/request`, {});
  }

  // ========== COMMUNICATION (broadcast email admin) ==========
  /** Envoie un email + message in-app à une liste de participants (via notification-service). */
  broadcastEmail(subject: string, message: string, recipients: string[]): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/notifications/broadcast`, { subject, message, recipients });
  }

  /** Messages in-app reçus par l'utilisateur connecté (boîte de réception). */
  getMyMessages(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/notifications/inbox`);
  }

  /** Marque un message in-app comme lu. */
  markMessageRead(id: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/notifications/inbox/${id}/read`, {});
  }

  // ========== ANALYTICS (stats serveur) ==========
  getRegistrationStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/registrations/stats`);
  }
  getAttendeeStats(attendeeId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/registrations/stats/attendee/${attendeeId}`);
  }
  getEventStats(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/events/stats`);
  }
}
