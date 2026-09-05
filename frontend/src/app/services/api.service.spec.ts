import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { ApiService } from './api.service';

/**
 * Contrat HTTP du front vers l'API Gateway.
 *
 * <p>Tout le frontend passe par ce service : une URL ou un verbe erroné casse
 * une fonctionnalité entière sans que la compilation ne dise rien. Ces tests
 * figent les appels du parcours métier critique (suivi de participation et
 * workflow de certificat) ainsi que l'encodage des paramètres.</p>
 */
describe('ApiService', () => {
  let service: ApiService;
  let http: HttpTestingController;

  // En test, l'origine n'est pas le port 4200 du serveur de dev : le service
  // bascule alors sur le préfixe relatif `/api` (même logique qu'en production
  // derrière nginx).
  const base = '/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  // ─────────── Suivi de participation ───────────

  it('récupère le suivi d’un participant sur l’endpoint dédié', () => {
    const expected = [{ id: 'reg-1', progressStatus: 'COMPLETED', certificateStatus: 'SENT' }];
    let received: any;

    service.getAttendeeTracking('kc-1').subscribe(r => (received = r));

    const req = http.expectOne(`${base}/registrations/attendee/kc-1/tracking`);
    expect(req.request.method).toBe('GET');
    req.flush(expected);
    expect(received).toEqual(expected);
  });

  it('télécharge le certificat en binaire', () => {
    service.downloadCertificate('reg-1').subscribe();

    const req = http.expectOne(`${base}/registrations/reg-1/certificate`);
    expect(req.request.method).toBe('GET');
    // Sans responseType blob, Angular tenterait de parser le PDF en JSON.
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob());
  });

  // ─────────── Workflow de certificat (administration) ───────────

  it('lit la file des certificats à traiter', () => {
    service.getPendingCertificates().subscribe();

    const req = http.expectOne(`${base}/registrations/certificates/pending`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('envoie un certificat en PUT', () => {
    service.sendCertificate('reg-1').subscribe();

    const req = http.expectOne(`${base}/registrations/reg-1/certificate/send`);
    expect(req.request.method).toBe('PUT');
    req.flush({ certificateStatus: 'SENT' });
  });

  it('diffère un certificat en PUT', () => {
    service.holdCertificate('reg-1').subscribe();

    const req = http.expectOne(`${base}/registrations/reg-1/certificate/hold`);
    expect(req.request.method).toBe('PUT');
    req.flush({ certificateStatus: 'PENDING_APPROVAL' });
  });

  it('déclenche l’envoi groupé d’une session en POST', () => {
    let result: any;
    service.sendCertificatesForEvent('ev-1').subscribe(r => (result = r));

    const req = http.expectOne(`${base}/registrations/certificates/event/ev-1/send-all`);
    expect(req.request.method).toBe('POST');
    req.flush({ eventId: 'ev-1', sent: 4 });
    expect(result.sent).toBe(4);
  });

  // ─────────── Inscriptions ───────────

  it('soumet une demande d’inscription à validation', () => {
    service.requestRegistrationApproval('ev-1', 'kc-1').subscribe();

    const req = http.expectOne(`${base}/registrations/event/ev-1/attendee/kc-1/request`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('encode les paramètres de billet dans l’URL d’inscription', () => {
    service.registerForEvent('ev-1', 'kc-1', 'Accès VIP', 120).subscribe();

    // L'espace du libellé doit être encodé, sinon l'URL est invalide.
    const req = http.expectOne(`${base}/registrations/event/ev-1/attendee/kc-1?ticketType=Acc%C3%A8s%20VIP&ticketPrice=120`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('omet les paramètres de billet quand ils ne sont pas fournis', () => {
    service.registerForEvent('ev-1', 'kc-1').subscribe();

    const req = http.expectOne(`${base}/registrations/event/ev-1/attendee/kc-1`);
    expect(req.request.urlWithParams).not.toContain('?');
    req.flush({});
  });

  // ─────────── Catalogue et administration ───────────

  it('ne demande que les sessions publiées pour la vue participant', () => {
    service.getPublishedEvents().subscribe();

    const req = http.expectOne(`${base}/events/published`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('transmet le statut de modération en paramètre de requête', () => {
    service.updateEventStatus('ev-1', 'APPROVED').subscribe();

    const req = http.expectOne(`${base}/events/ev-1/status?status=APPROVED`);
    expect(req.request.method).toBe('PUT');
    req.flush({});
  });

  it('adresse la diffusion admin au notification-service', () => {
    service.broadcastEmail('Objet', 'Message', ['a@linsoft.tn', 'b@linsoft.tn']).subscribe();

    const req = http.expectOne(`${base}/notifications/broadcast`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      subject: 'Objet', message: 'Message', recipients: ['a@linsoft.tn', 'b@linsoft.tn']
    });
    req.flush({ sent: 2 });
  });

  // ─────────── Remontée des erreurs ───────────

  it('propage une erreur HTTP à l’appelant', () => {
    let status = 0;
    service.getPendingCertificates().subscribe({ error: e => (status = e.status) });

    http.expectOne(`${base}/registrations/certificates/pending`)
        .flush({ error: 'refusé' }, { status: 403, statusText: 'Forbidden' });

    // L'interface s'appuie sur ce code pour distinguer « droit refusé » de
    // « certificat pas encore délivré » (409).
    expect(status).toBe(403);
  });
});
