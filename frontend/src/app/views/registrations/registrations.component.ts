import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { categoryColor } from '../../shared/categories';

interface RegistrationEnriched {
  id: string;
  eventId: string;
  attendeeId: string;
  registrationDate: string;
  status: string;
  qrCodeTicket?: string;
  checkedIn?: boolean;
  checkedInAt?: string;
  ticketType?: string;
  eventTitle?: string;
  eventDate?: string;
  eventCategory?: string;
  attendeeName?: string;
  attendeeEmail?: string;
}

@Component({
  selector: 'app-registrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './registrations.component.html',
  styleUrls: ['./registrations.component.scss']
})
export class RegistrationsComponent implements OnInit {
  private apiService = inject(ApiService);

  registrations: RegistrationEnriched[] = [];
  users: any[] = [];
  events: any[] = [];
  loading = false;
  search = '';
  statusFilter: 'all' | 'CONFIRMED' | 'CANCELLED' | 'PENDING' = 'all';
  presenceFilter: 'all' | 'present' | 'absent' = 'all';
  cancelConfirm: string | null = null;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  ngOnInit(): void { this.loadAll(); }

  get filteredRegistrations(): RegistrationEnriched[] {
    const q = this.search.toLowerCase();
    return this.registrations.filter(r => {
      const matchSearch = !q ||
        (r.eventTitle || '').toLowerCase().includes(q) ||
        (r.attendeeName || '').toLowerCase().includes(q) ||
        (r.attendeeEmail || '').toLowerCase().includes(q) ||
        (r.id || '').toLowerCase().includes(q);
      const matchStatus = this.statusFilter === 'all' || r.status === this.statusFilter;
      const matchPresence = this.presenceFilter === 'all'
        || (this.presenceFilter === 'present' && r.checkedIn)
        || (this.presenceFilter === 'absent' && !r.checkedIn);
      return matchSearch && matchStatus && matchPresence;
    });
  }

  getStatusCount(status: string): number {
    return this.registrations.filter(r => r.status === status).length;
  }

  get presentCount(): number { return this.registrations.filter(r => r.checkedIn).length; }
  get presenceRate(): number {
    const confirmed = this.registrations.filter(r => r.status === 'CONFIRMED').length;
    return confirmed ? Math.round((this.presentCount / confirmed) * 100) : 0;
  }

  /** Export CSV de la liste filtrée (compatible Excel). */
  exportCsv(): void {
    const headers = ['Participant', 'Email', 'Événement', 'Date inscription', 'Statut', 'Présent', "Type d'inscription"];
    const rows = this.filteredRegistrations.map(r => [
      r.attendeeName, r.attendeeEmail, r.eventTitle,
      r.registrationDate ? new Date(r.registrationDate).toLocaleString('fr-FR') : '',
      r.status, r.checkedIn ? 'Oui' : 'Non', r.ticketType
    ]);
    const esc = (v: any) => { const s = (v ?? '').toString().replace(/"/g, '""'); return /[";\n]/.test(s) ? `"${s}"` : s; };
    const csv = [headers, ...rows].map(l => l.map(esc).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'inscriptions.csv'; a.click();
    URL.revokeObjectURL(url);
    this.showToast('Export généré : inscriptions.csv', 'success');
  }

  loadAll(): void {
    this.loading = true;
    forkJoin({
      regs: this.apiService.getAllRegistrations(),
      users: this.apiService.getAllUsers(),
      events: this.apiService.getAllEvents()
    }).subscribe({
      next: ({ regs, users, events }) => {
        this.users = users;
        this.events = events;
        const userMap = new Map(users.map((u: any) => [u.keycloakId, u]));
        const eventMap = new Map(events.map((e: any) => [e.id, e]));

        this.registrations = regs.map((r: any) => {
          const u = userMap.get(r.attendeeId);
          const e = eventMap.get(r.eventId);
          return {
            ...r,
            eventTitle: e?.title || '(événement supprimé)',
            eventDate: e?.eventDate,
            eventCategory: e?.category,
            attendeeName: u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email : '(utilisateur inconnu)',
            attendeeEmail: u?.email
          };
        }).sort((a, b) =>
          new Date(b.registrationDate || 0).getTime() - new Date(a.registrationDate || 0).getTime()
        );
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.showToast('Erreur lors du chargement', 'error');
      }
    });
  }

  cancelRegistration(id: string): void {
    this.apiService.cancelRegistration(id).subscribe({
      next: () => {
        this.registrations = this.registrations.map(r => r.id === id ? { ...r, status: 'CANCELLED' } : r);
        this.cancelConfirm = null;
        this.showToast('Inscription annulée', 'success');
      },
      error: () => this.showToast('Erreur lors de l\'annulation', 'error')
    });
  }

  /** Libellé lisible du statut d'inscription. */
  statusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED': return 'Confirmée';
      case 'CANCELLED': return 'Annulée';
      case 'PENDING':   return 'En attente';
      case 'REJECTED':  return 'Refusée';
      default:          return status || '—';
    }
  }

  /** Télécharge le certificat de participation (PDF) d'une inscription confirmée. */
  downloadCertificate(reg: RegistrationEnriched): void {
    this.apiService.downloadCertificate(reg.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `certificat-${this.shortId(reg.id)}.pdf`; a.click();
        URL.revokeObjectURL(url);
        this.showToast('Certificat téléchargé', 'success');
      },
      error: () => this.showToast('Certificat indisponible', 'error')
    });
  }

  /** Le manager approuve une demande en attente. */
  approve(reg: RegistrationEnriched): void {
    this.apiService.approveRegistration(reg.id).subscribe({
      next: () => {
        this.registrations = this.registrations.map(r => r.id === reg.id ? { ...r, status: 'CONFIRMED' } : r);
        this.showToast('Inscription approuvée', 'success');
      },
      error: () => this.showToast('Erreur lors de l\'approbation', 'error')
    });
  }

  /** Le manager refuse une demande en attente. */
  reject(reg: RegistrationEnriched): void {
    this.apiService.rejectRegistration(reg.id).subscribe({
      next: () => {
        this.registrations = this.registrations.map(r => r.id === reg.id ? { ...r, status: 'REJECTED' } : r);
        this.showToast('Inscription refusée', 'success');
      },
      error: () => this.showToast('Erreur lors du refus', 'error')
    });
  }

  getAttendeeInitials(reg: RegistrationEnriched): string {
    const name = reg.attendeeName || '';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return (parts[0]?.[0] || '?').toUpperCase();
  }

  getAvatarBg(reg: RegistrationEnriched): string {
    const seed = (reg.attendeeId || '').length;
    const palette = [
      'linear-gradient(135deg,#667eea,#764ba2)',
      'linear-gradient(135deg,#f093fb,#f5576c)',
      'linear-gradient(135deg,#4facfe,#00f2fe)',
      'linear-gradient(135deg,#43e97b,#38f9d7)',
      'linear-gradient(135deg,#fa709a,#fee140)',
      'linear-gradient(135deg,#30cfd0,#330867)'
    ];
    return palette[seed % palette.length];
  }

  catColor(cat: string): string { return categoryColor(cat); }

  /** Derniers caractères : le début d'un ObjectId est un horodatage, non distinctif. */
  shortId(id: any): string {
    return String(id || '').slice(-8).toUpperCase();
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { message, type };
    setTimeout(() => this.toast = null, 3500);
  }
}
