import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CATEGORIES, categoryGradient } from '../../shared/categories';
import { NotifsService } from '../../services/notifs.service';

/** Un type de session = un onglet de la barre de navigation de la section. */
interface EventType {
  key: string;      // valeur stockée côté backend
  slug: string;     // valeur portée par l'URL (?type=…)
  label: string;    // libellé de l'onglet (pluriel)
  desc: string;
  create: string;   // libellé au singulier, proposé à la création
  pitch: string;    // ce que ce format apporte (aide au choix)
}

export const EVENT_TYPES: EventType[] = [
  { key: 'FORMATION', slug: 'formation', label: 'Formations', desc: 'Sessions de formation', create: 'Formation', pitch: 'Un programme structuré, sur une ou plusieurs séances.' },
  { key: 'WORKSHOP', slug: 'workshop', label: 'Workshops', desc: 'Ateliers pratiques', create: 'Workshop', pitch: 'Un atelier pratique, en petit groupe, autour d’un outil.' },
  { key: 'CONFERENCE', slug: 'conference', label: 'Conférences', desc: 'Conférences et présentations', create: 'Conférence', pitch: 'Une présentation devant un large public.' }
];

/** Sessions sans type exploitable (données héritées) : ni formation, ni workshop, ni conférence. */
const UNCLASSIFIED = 'AUTRE';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.scss']
})
export class EventsComponent implements OnInit {
  events: any[] = [];
  formateurs: any[] = [];
  categories = CATEGORIES;
  /** Onglets de la barre de navigation de la section. */
  readonly eventTypes = EVENT_TYPES;
  /** Type consulté (piloté par ?type=… dans l'URL). */
  activeType = EVENT_TYPES[0].key;
  loading = false;
  creating = false;
  showForm = false;
  /** Bande de choix du type, affichée avant le formulaire de création. */
  typePicker = false;

  /**
   * Vrai pendant tout le parcours de création (choix du type puis formulaire).
   * La page bascule alors en vue dédiée : la liste, les filtres et les
   * compteurs s'effacent pour ne pas concurrencer la saisie.
   */
  get inCreation(): boolean { return this.typePicker || this.showForm; }
  activeFilter = '';
  statusFilter = '';
  search = '';
  deleteConfirm: string | null = null;
  moderateBusy: string | null = null;
  /** Session en cours d'édition (copie de travail). */
  editEvent: any = null;
  savingEdit = false;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  formData: any = {
    title: '', description: '', eventDate: '', location: '',
    category: 'Red Hat', type: 'FORMATION', mode: 'PRESENTIEL', visioLink: '',
    totalSeats: 50, organizerId: ''
  };

  private readonly catMap: Record<string, string> = {
    'cloud': 'cloud',
    'devops': 'devops',
    'cybersécurité': 'cybersecurite',
    'certification': 'certification',
    'workshop': 'workshop',
    'conférence': 'conference',
    'autre': 'autre'
  };

  constructor(
    private apiService: ApiService,
    private notifs: NotifsService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Le type actif vient de l'URL : la sélection survit au rechargement et
    // reste partageable, et la sidebar continue de surligner la section.
    this.route.queryParams.subscribe(p => {
      const slug = String(p['type'] || '').toLowerCase();
      const found = this.eventTypes.find(t => t.slug === slug);
      this.activeType = found ? found.key : (slug === 'autres' ? UNCLASSIFIED : this.eventTypes[0].key);
    });
    this.loadEvents();
    this.loadFormateurs();
  }

  /** Ouvre un type de session (met à jour l'URL, donc l'onglet actif). */
  selectType(key: string): void {
    const slug = this.eventTypes.find(t => t.key === key)?.slug || 'autres';
    this.router.navigate([], { relativeTo: this.route, queryParams: { type: slug } });
  }

  /** Type normalisé d'une session : l'un des trois, sinon « non classé ». */
  private normType(e: any): string {
    const t = (e?.type || '').toUpperCase();
    return this.eventTypes.some(x => x.key === t) ? t : UNCLASSIFIED;
  }

  /** Nombre de sessions d'un type (compteur affiché sur l'onglet). */
  typeCount(key: string): number {
    return this.events.filter(e => this.normType(e) === key).length;
  }

  /** Sessions du type actuellement consulté (avant filtres de la barre d'outils). */
  get typeEvents(): any[] {
    return this.events.filter(e => this.normType(e) === this.activeType);
  }

  get unclassifiedCount(): number { return this.typeCount(UNCLASSIFIED); }
  get unclassifiedKey(): string { return UNCLASSIFIED; }

  /** Libellé du type actif, réutilisé dans les textes de la page. */
  get activeTypeLabel(): string {
    return this.eventTypes.find(t => t.key === this.activeType)?.label || 'Sessions non classées';
  }

  loadFormateurs(): void {
    this.apiService.getAllUsers().subscribe({
      next: (us: any[]) => {
        this.formateurs = (us || [])
          .filter(u => (u.role || '').toUpperCase() === 'ORGANISATEUR')
          .sort((a, b) => `${a.firstName || ''} ${a.lastName || ''}`.localeCompare(`${b.firstName || ''} ${b.lastName || ''}`));
      },
      error: () => { /* liste vide : le champ reste utilisable mais sans suggestions */ }
    });
  }

  formateurName(id: string): string {
    const f = this.formateurs.find(u => u.keycloakId === id || u.id === id);
    if (!f) return id || '—';
    return `${f.firstName || ''} ${f.lastName || ''}`.trim() || f.email || id;
  }

  get filteredEvents(): any[] {
    const q = this.search.toLowerCase().trim();
    return this.typeEvents.filter(e => {
      const matchCat = !this.activeFilter || e.category === this.activeFilter;
      const matchStatus = !this.statusFilter || this.statusKey(e) === this.statusFilter;
      const matchSearch = !q || `${e.title || ''} ${e.location || ''} ${e.category || ''}`.toLowerCase().includes(q);
      return matchCat && matchStatus && matchSearch;
    });
  }

  // ─── Statut / format ───
  statusKey(e: any): string {
    const s = (e.status || '').toUpperCase();
    if (s === 'PENDING') return 'pending';
    if (s === 'REJECTED') return 'rejected';
    return 'approved';
  }
  statusLabel(e: any): string {
    const k = this.statusKey(e);
    return k === 'pending' ? 'En attente' : k === 'rejected' ? 'Refusé' : 'Publié';
  }
  typeLabel(e: any): string { const t = (e?.type || '').toUpperCase(); return t === 'FORMATION' ? 'Formation' : t === 'WORKSHOP' ? 'Workshop' : t === 'CONFERENCE' ? 'Conférence' : t === 'SEMINAIRE' ? 'Séminaire' : 'Événement'; }
  modeLabel(e: any): string {
    const m = (e?.mode || '').toUpperCase();
    if (m === 'EN_LIGNE') return 'En ligne';
    if (m === 'HYBRIDE') return 'Hybride';
    return 'Présentiel';
  }

  // KPIs du type consulté (les totaux par type sont portés par les onglets).
  get typeTotal(): number { return this.typeEvents.length; }
  get publishedCount(): number { return this.typeEvents.filter(e => this.statusKey(e) === 'approved').length; }
  get pendingCount(): number { return this.typeEvents.filter(e => this.statusKey(e) === 'pending').length; }
  get rejectedCount(): number { return this.typeEvents.filter(e => this.statusKey(e) === 'rejected').length; }

  getCatKey(cat: string): string {
    return this.catMap[(cat || '').toLowerCase()] || 'default';
  }

  getCatEmoji(_cat: string): string { return ''; }

  getCatCount(cat: string): number {
    return this.events.filter(e => e.category === cat).length;
  }

  getFreeCount(): number {
    return this.events.filter(e => !e.price || e.price === 0).length;
  }

  /** Pourcentage des places RÉSERVÉES (0 = vide, 100 = complet). */
  getSeatsPct(ev: any): number {
    if (!ev.totalSeats) return 0;
    const avail = ev.availableSeats ?? ev.totalSeats;
    const reserved = ev.totalSeats - avail;
    return Math.round((reserved / ev.totalSeats) * 100);
  }

  catGradient(cat: string): string { return categoryGradient(cat); }
  loadEvents(): void {
    this.loading = true;
    // Vue admin : tous les événements (y compris en attente de modération)
    this.apiService.getAllEvents().subscribe({
      next: d => { this.events = d; this.loading = false; },
      error: () => { this.loading = false; this.showToast('Erreur de chargement.', 'error'); }
    });
  }

  createEvent(): void {
    if (!this.formData.title || !this.formData.eventDate) {
      this.showToast('Veuillez remplir le titre et la date.', 'error');
      return;
    }
    this.creating = true;
    // Joindre l'email/nom du formateur choisi → notification de création envoyée par le backend
    const f = this.formateurs.find(u => u.keycloakId === this.formData.organizerId || u.id === this.formData.organizerId);
    const payload = {
      ...this.formData,
      organizerEmail: f?.email || '',
      organizerName: f ? `${f.firstName || ''} ${f.lastName || ''}`.trim() : ''
    };
    this.apiService.createEvent(payload).subscribe({
      next: ev => {
        this.events = [ev, ...this.events];
        this.notifs.push('info', 'event', 'Événement créé', `${payload.title}`, undefined, { path: '/events' });
        this.resetForm();
        this.creating = false;
        // Créé par un admin, l'événement est publié d'emblée ; sinon il attend une validation.
        const published = String(ev?.status || '').toUpperCase() === 'APPROVED';
        this.showToast(published ? 'Événement créé et publié.' : 'Événement créé — en attente de validation.', 'success');
      },
      error: (err) => {
        this.creating = false;
        const msg = err?.status === 403 ? 'Accès refusé (rôle requis)'
          : err?.status === 401 ? 'Session expirée'
          : 'Données invalides ou erreur serveur.';
        this.showToast(msg, 'error');
      }
    });
  }

  /** Modération : approuver (publier) ou refuser un événement en attente. */
  moderate(ev: any, status: 'APPROVED' | 'REJECTED'): void {
    this.moderateBusy = ev.id;
    this.apiService.updateEventStatus(ev.id, status).subscribe({
      next: () => {
        ev.status = status;
        this.moderateBusy = null;
        this.showToast(status === 'APPROVED' ? 'Événement publié.' : 'Événement refusé.', 'success');
      },
      error: () => { this.moderateBusy = null; this.showToast('Erreur lors de la modération.', 'error'); }
    });
  }

  // ─── Édition d'une session ───

  /** Ouvre la fiche d'édition (la date est normalisée pour `datetime-local`). */
  openEdit(ev: any): void {
    this.editEvent = { ...ev, eventDate: this.toLocalInput(ev.eventDate) };
  }
  closeEdit(): void { this.editEvent = null; }

  /** `2026-05-16T09:00:00` → valeur acceptée par un champ datetime-local. */
  private toLocalInput(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  saveEdit(): void {
    if (!this.editEvent) return;
    if (!this.editEvent.title?.trim() || !this.editEvent.eventDate) {
      this.showToast('Le titre et la date sont requis.', 'error');
      return;
    }
    this.savingEdit = true;
    this.apiService.updateEvent(this.editEvent.id, this.editEvent).subscribe({
      next: updated => {
        this.events = this.events.map(e => e.id === updated.id ? updated : e);
        this.savingEdit = false;
        this.editEvent = null;
        this.showToast('Session mise à jour.', 'success');
      },
      error: () => { this.savingEdit = false; this.showToast('Erreur lors de l\'enregistrement.', 'error'); }
    });
  }

  deleteEvent(id: string): void {
    this.apiService.deleteEvent(id).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.id !== id);
        this.deleteConfirm = null;
        this.showToast('Événement supprimé.', 'success');
      },
      error: () => this.showToast('Erreur lors de la suppression.', 'error')
    });
  }

  /**
   * Bouton « Nouvel événement » : on ne saute plus directement au formulaire.
   * On ouvre d'abord le sélecteur de type (bande rouge) ; un second clic
   * — le bouton devient « Annuler » — referme tout.
   */
  toggleForm(): void {
    if (this.showForm || this.typePicker) { this.resetForm(); return; }
    this.formData.type = this.defaultFormType;
    this.typePicker = true;
  }

  /** Type retenu dans la bande : le formulaire s'ouvre pré-rempli. */
  chooseType(key: string): void {
    this.formData.type = key;
    this.typePicker = false;
    this.showForm = true;
  }

  /** Type proposé à la création : celui de l'onglet, jamais « non classé ». */
  private get defaultFormType(): string {
    return this.activeType === UNCLASSIFIED ? this.eventTypes[0].key : this.activeType;
  }

  resetForm(): void {
    this.formData = {
      title: '', description: '', eventDate: '', location: '',
      category: this.categories[0], type: this.defaultFormType, mode: 'PRESENTIEL',
      visioLink: '', totalSeats: 50, organizerId: ''
    };
    this.showForm = false;
    this.typePicker = false;
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { message, type };
    setTimeout(() => this.toast = null, 3500);
  }
}
