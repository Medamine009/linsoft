import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-ticket-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tv">
      <div class="tv-bg">
        <div class="tv-orb tv-o1"></div>
        <div class="tv-orb tv-o2"></div>
      </div>

      <div class="tv-content">
        <!-- Loading -->
        <div *ngIf="loading" class="tv-loading">
          <div class="tv-spinner"></div>
          <p>Chargement du billet…</p>
        </div>

        <!-- Not found -->
        <div *ngIf="!loading && !ticket" class="tv-error">
          <div class="tv-err-icon">
            <svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="28" stroke="currentColor" stroke-width="3"/><path d="M24 24l16 16M40 24L24 40" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          </div>
          <h1>Billet introuvable</h1>
          <p>Ce billet n'existe pas ou a été supprimé.</p>
        </div>

        <!-- REAL TICKET -->
        <div *ngIf="!loading && ticket" class="tv-card" [class.tv-cancelled]="!ticket.valid">
          <div class="tv-shine"></div>

          <!-- Banner image avec overlay -->
          <div class="tv-banner" [style.background-image]="bannerUrl">
            <div class="tv-banner-shade"></div>
            <div class="tv-banner-top">
              <div class="tv-brand">
                <div class="tv-logo">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M7 8l5 3 5-3M7 16l5 3 5-3M7 12l5 3 5-3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </div>
                <span>LINSOFT Learning Center</span>
              </div>
              <span class="tv-status" [class.st-valid]="ticket.valid" [class.st-invalid]="!ticket.valid">
                <span class="st-dot"></span>
                {{ ticket.valid ? 'Valide' : 'Annulé' }}
              </span>
            </div>
            <div class="tv-banner-bottom">
              <span class="tv-cat" *ngIf="event?.category">{{ event.category }}</span>
              <h1 class="tv-event-title">{{ event?.title || ticket.eventTitle || 'Événement' }}</h1>
            </div>
          </div>

          <!-- Détails -->
          <div class="tv-main">
            <div class="tv-info-grid">
              <div class="tv-info">
                <div class="tv-i-icon" style="background:#ecebff;color:#e30613">
                  <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="5" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h14M7 3v4M13 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </div>
                <div>
                  <div class="tv-i-label">Date</div>
                  <div class="tv-i-value">{{ eventDate ? formatDate(eventDate) : (ticket.registrationDate | date:'dd MMM yyyy') }}</div>
                </div>
              </div>
              <div class="tv-info">
                <div class="tv-i-icon" style="background:#ecfdf5;color:#10b981">
                  <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.8"/><path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </div>
                <div>
                  <div class="tv-i-label">Heure</div>
                  <div class="tv-i-value">{{ eventDate ? (eventDate | date:'HH:mm') : '—' }}</div>
                </div>
              </div>
              <div class="tv-info">
                <div class="tv-i-icon" style="background:#fef3c7;color:#f59e0b">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M10 18s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10z" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="8" r="2" stroke="currentColor" stroke-width="1.8"/></svg>
                </div>
                <div>
                  <div class="tv-i-label">Lieu</div>
                  <div class="tv-i-value">{{ event?.location || ticket.eventLocation || 'À définir' }}</div>
                </div>
              </div>
              <div class="tv-info">
                <div class="tv-i-icon" style="background:#fee2e2;color:#ef4444">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M4 8h12l-1 9H5L4 8zM7 8V5a3 3 0 0 1 6 0v3" stroke="currentColor" stroke-width="1.8"/></svg>
                </div>
                <div>
                  <div class="tv-i-label">Format</div>
                  <div class="tv-i-value">{{ event?.mode === 'EN_LIGNE' ? 'En ligne' : event?.mode === 'HYBRIDE' ? 'Hybride' : 'Présentiel' }}</div>
                </div>
              </div>
            </div>

            <div class="tv-attendee" *ngIf="ticket.attendeeName">
              <div class="tv-att-ava">{{ initials(ticket.attendeeName) }}</div>
              <div>
                <div class="tv-att-label">Titulaire du billet</div>
                <div class="tv-att-name">{{ ticket.attendeeName }}</div>
              </div>
            </div>

            <p class="tv-desc" *ngIf="event?.description">{{ event.description }}</p>
          </div>

          <!-- Perforation -->
          <div class="tv-perf">
            <div class="tv-notch tv-notch-l"></div>
            <div class="tv-perf-line"></div>
            <div class="tv-notch tv-notch-r"></div>
          </div>

          <!-- Stub QR -->
          <div class="tv-stub">
            <div class="tv-qr">
              <img *ngIf="qrUrl" [src]="qrUrl" alt="QR">
              <div *ngIf="!qrUrl" class="tv-qr-load"><div class="tv-spinner sm"></div></div>
            </div>
            <div class="tv-stub-info">
              <div class="tv-ref-label">Référence du billet</div>
              <div class="tv-ref">#{{ shortId(ticket.id) }}</div>
              <div class="tv-zone">{{ ticket.ticketType ? ('Billet ' + ticket.ticketType) : 'Admission' }} · Admit One</div>
            </div>
          </div>
        </div>

        <div *ngIf="!loading && ticket" class="tv-foot">
          Présentez ce billet à l'entrée · © 2026 LINSOFT
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./ticket-view.component.scss']
})
export class TicketViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8080/api';

  loading = true;
  ticket: any = null;
  event: any = null;
  qrUrl: string | null = null;

  get eventDate(): string | null {
    return this.event?.eventDate || this.ticket?.eventDateStr || null;
  }

  get bannerUrl(): string {
    const map: Record<string, string> = {
      concert: 'linear-gradient(135deg,#7c3aed,#a855f7)',
      gala: 'linear-gradient(135deg,#c9a14a,#e7c87e)',
      sport: 'linear-gradient(135deg,#0a8043,#10b981)',
      culture: 'linear-gradient(135deg,#0e7490,#06b6d4)',
      autre: 'linear-gradient(135deg,#44403c,#6b6760)'
    };
    const cat = (this.event?.category || '').toLowerCase();
    return map[cat] || 'linear-gradient(135deg,#e30613,#ff3341)';
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading = false; return; }

    this.http.get<any>(`${this.apiUrl}/registrations/${id}/verify`).subscribe({
      next: (data) => {
        this.ticket = data;
        this.loading = false;

        // Charge le détail complet de l'événement (public)
        if (data.eventId) {
          this.http.get<any>(`${this.apiUrl}/events/${data.eventId}/public`).subscribe({
            next: (ev) => this.event = ev,
            error: () => {}
          });
        }

        // QR (encode l'URL du billet)
        const ticketUrl = `${window.location.origin}/ticket/${id}`;
        const params = new URLSearchParams({ content: ticketUrl, size: '200' });
        this.http.get(`${this.apiUrl}/tickets/qr?${params.toString()}`, { responseType: 'blob' }).subscribe({
          next: (blob) => {
            const reader = new FileReader();
            reader.onloadend = () => this.qrUrl = reader.result as string;
            reader.readAsDataURL(blob);
          },
          error: () => {}
        });
      },
      error: () => { this.loading = false; this.ticket = null; }
    });
  }

  shortId(id: any): string { return String(id || '').slice(0, 8).toUpperCase(); }

  initials(name: string): string {
    const parts = (name || '').split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] || '?').toUpperCase();
  }

  formatDate(s: string): string {
    try {
      return new Date(s).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return s; }
  }
}
