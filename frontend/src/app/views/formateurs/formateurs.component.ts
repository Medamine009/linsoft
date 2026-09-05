import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { categoryColor } from '../../shared/categories';
import { PeopleNavComponent } from '../../components/people-nav/people-nav.component';

interface FormateurStat {
  user: any;
  events: any[];
  formations: number;
  inscriptions: number;
  presents: number;
  presenceRate: number;
  nextSession: any | null;
}

@Component({
  selector: 'app-formateurs',
  standalone: true,
  imports: [CommonModule, FormsModule, PeopleNavComponent],
  template: `
    <div class="fm">
      <!-- En-tête -->
      <header class="fm-head">
        <div>
          <h1 class="fm-h1">Gestion des utilisateurs</h1>
          <p class="fm-sub">Suivi des formateurs LINSOFT : formations animées, inscriptions et taux de présence.</p>
        </div>
        <button class="fm-btn-ghost" (click)="load()" [class.spin]="loading">
          <svg viewBox="0 0 16 16" fill="none"><path d="M14 8a6 6 0 1 1-2-4.5M14 2v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Actualiser
        </button>
      </header>

      <!-- Navigation par population (partagée avec /users) -->
      <app-people-nav active="formateur" [counts]="roleCounts"></app-people-nav>

      <!-- KPIs -->
      <div class="fm-kpis">
        <div class="fm-kpi">
          <div class="fm-kpi-val">{{ formateurs.length }}</div>
          <div class="fm-kpi-lbl">Formateurs actifs</div>
        </div>
        <div class="fm-kpi">
          <div class="fm-kpi-val">{{ totalFormations }}</div>
          <div class="fm-kpi-lbl">Formations animées</div>
        </div>
        <div class="fm-kpi">
          <div class="fm-kpi-val">{{ totalInscriptions }}</div>
          <div class="fm-kpi-lbl">Apprenants inscrits</div>
        </div>
        <div class="fm-kpi">
          <div class="fm-kpi-val">{{ globalPresence }}%</div>
          <div class="fm-kpi-lbl">Taux de présence moyen</div>
        </div>
      </div>

      <!-- Recherche -->
      <div class="fm-toolbar">
        <div class="fm-search">
          <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          <input placeholder="Rechercher un formateur…" [(ngModel)]="search">
        </div>
        <span class="fm-count">{{ filtered.length }} formateur(s)</span>
      </div>

      <!-- Tableau -->
      <div class="fm-panel">
        <div *ngIf="loading" class="fm-empty">Chargement…</div>
        <div *ngIf="!loading && filtered.length === 0" class="fm-empty">Aucun formateur. Nommez un formateur depuis la gestion des utilisateurs.</div>

        <table class="fm-table" *ngIf="!loading && filtered.length > 0">
          <thead>
            <tr>
              <th>Formateur</th>
              <th>Département</th>
              <th>Formations</th>
              <th>Inscrits</th>
              <th>Présence</th>
              <th>Prochaine session</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let f of filtered">
              <td>
                <div class="fm-user">
                  <div class="fm-ava">{{ initials(f.user) }}</div>
                  <div>
                    <div class="fm-name">{{ f.user.firstName }} {{ f.user.lastName }}</div>
                    <div class="fm-mail">{{ f.user.email }}</div>
                  </div>
                </div>
              </td>
              <td class="fm-mute">{{ f.user.department || '—' }}</td>
              <td><span class="fm-pill">{{ f.formations }}</span></td>
              <td class="fm-mute">{{ f.inscriptions }}</td>
              <td>
                <div class="fm-bar"><span [style.width.%]="f.presenceRate"></span></div>
                <span class="fm-bar-val">{{ f.presenceRate }}%</span>
              </td>
              <td class="fm-mute">{{ f.nextSession ? (f.nextSession.eventDate | date:'dd MMM yyyy') : '—' }}</td>
              <td class="fm-actions">
                <button class="fm-view" (click)="open(f)">Voir profil</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Fiche profil (modale) -->
      <div *ngIf="selected" class="fm-overlay" (click)="selected = null">
        <div class="fm-modal" (click)="$event.stopPropagation()">
          <button class="fm-close" (click)="selected = null">✕</button>

          <div class="fm-modal-head">
            <div class="fm-ava fm-ava-lg">{{ initials(selected.user) }}</div>
            <div>
              <h2 class="fm-modal-name">{{ selected.user.firstName }} {{ selected.user.lastName }}</h2>
              <div class="fm-modal-meta">
                <span class="fm-tag">Formateur</span>
                <span>{{ selected.user.department || 'Département non défini' }}</span>
                <span>{{ selected.user.email }}</span>
              </div>
            </div>
          </div>

          <p class="fm-bio" *ngIf="selected.user.bio">{{ selected.user.bio }}</p>

          <div class="fm-modal-stats">
            <div><strong>{{ selected.formations }}</strong><span>Formations</span></div>
            <div><strong>{{ selected.inscriptions }}</strong><span>Inscrits</span></div>
            <div><strong>{{ selected.presents }}</strong><span>Présents</span></div>
            <div><strong>{{ selected.presenceRate }}%</strong><span>Présence</span></div>
          </div>

          <h3 class="fm-modal-sub">Historique des formations</h3>
          <div class="fm-hist">
            <div *ngIf="selected.events.length === 0" class="fm-empty">Aucune formation publiée.</div>
            <div class="fm-hist-row" *ngFor="let e of selected.events">
              <div class="fm-hist-dot" [style.background]="catColor(e.category)"></div>
              <div class="fm-hist-info">
                <div class="fm-hist-title">{{ e.title }}</div>
                <div class="fm-hist-meta">{{ e.category || '—' }} · {{ e.eventDate | date:'dd MMM yyyy' }} · {{ e.location || 'En ligne' }}</div>
              </div>
              <span class="fm-hist-status status-{{ statusKey(e) }}">{{ statusLabel(e) }}</span>
              <span class="fm-hist-count">{{ countInscrits(e) }} inscrits</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .fm { font-family: 'Inter', system-ui, sans-serif; padding-bottom: 60px; color: var(--text-primary, #18181b); }
    .fm-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .fm-h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 6px; }
    .fm-sub { font-size: 14px; color: var(--text-secondary, #6b6b70); margin: 0; }
    .fm-btn-ghost { display: inline-flex; align-items: center; gap: 7px; padding: 9px 14px; border-radius: 9px; border: 1px solid var(--border-default, #e4e4e7); background: var(--surface-base, #fff); color: var(--text-primary, #18181b); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .fm-btn-ghost svg { width: 14px; height: 14px; }
    .fm-btn-ghost.spin svg { animation: fm-spin 1s linear infinite; }
    @keyframes fm-spin { to { transform: rotate(360deg); } }

    .fm-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    @media (max-width: 900px) { .fm-kpis { grid-template-columns: repeat(2, 1fr); } }
    .fm-kpi { background: var(--surface-base, #fff); border: 1px solid var(--border-subtle, #eee); border-radius: 12px; padding: 18px 20px; }
    .fm-kpi-val { font-size: 28px; font-weight: 800; letter-spacing: -1px; color: var(--accent-primary, #e30613); }
    .fm-kpi-lbl { font-size: 12px; color: var(--text-tertiary, #9a9aa0); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 6px; }

    .fm-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; flex-wrap: wrap; }
    .fm-search { display: flex; align-items: center; gap: 8px; background: var(--surface-base, #fff); border: 1px solid var(--border-default, #e4e4e7); border-radius: 9px; padding: 8px 12px; width: 320px; max-width: 100%; }
    .fm-search svg { width: 14px; height: 14px; color: var(--text-tertiary, #9a9aa0); }
    .fm-search input { border: none; background: transparent; outline: none; font-size: 13px; font-family: inherit; flex: 1; color: inherit; }
    .fm-count { font-size: 13px; color: var(--text-tertiary, #9a9aa0); }

    .fm-panel { background: var(--surface-base, #fff); border: 1px solid var(--border-subtle, #eee); border-radius: 14px; overflow: hidden; }
    .fm-empty { padding: 40px; text-align: center; color: var(--text-tertiary, #9a9aa0); font-size: 14px; }
    .fm-table { width: 100%; border-collapse: collapse; }
    .fm-table thead th { text-align: left; padding: 12px 20px; font-size: 11px; font-weight: 600; color: var(--text-tertiary, #9a9aa0); text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid var(--border-subtle, #eee); background: var(--surface-subtle, #fafafa); }
    .fm-table tbody td { padding: 14px 20px; border-bottom: 1px solid var(--border-subtle, #f0f0f2); vertical-align: middle; font-size: 14px; }
    .fm-table tbody tr:last-child td { border-bottom: none; }
    .fm-table tbody tr:hover { background: var(--surface-subtle, #fafafa); }
    .fm-user { display: flex; align-items: center; gap: 12px; }
    .fm-ava { width: 38px; height: 38px; border-radius: 10px; background: var(--accent-primary, #e30613); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    .fm-name { font-weight: 600; color: var(--text-primary, #18181b); }
    .fm-mail { font-size: 12px; color: var(--text-tertiary, #9a9aa0); margin-top: 2px; }
    .fm-mute { color: var(--text-secondary, #6b6b70); }
    .fm-pill { display: inline-block; min-width: 26px; text-align: center; padding: 2px 9px; border-radius: 20px; background: var(--accent-primary-soft, #fdeceb); color: var(--accent-primary, #e30613); font-weight: 700; font-size: 13px; }
    .fm-bar { display: inline-block; width: 80px; height: 7px; background: var(--surface-muted, #f1f1f3); border-radius: 4px; overflow: hidden; vertical-align: middle; }
    .fm-bar span { display: block; height: 100%; background: var(--accent-primary, #e30613); border-radius: 4px; }
    .fm-bar-val { font-size: 12px; font-weight: 700; color: var(--text-primary, #18181b); margin-left: 8px; }
    .fm-actions { text-align: right; }
    .fm-view { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--accent-primary, #e30613); background: var(--accent-primary-soft, #fdeceb); color: var(--accent-primary, #e30613); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .fm-view:hover { background: var(--accent-primary, #e30613); color: #fff; }

    /* Modale */
    .fm-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .fm-modal { background: var(--surface-base, #fff); border-radius: 18px; max-width: 620px; width: 100%; max-height: 88vh; overflow-y: auto; padding: 30px; position: relative; box-shadow: 0 30px 70px rgba(0,0,0,0.3); }
    .fm-close { position: absolute; top: 18px; right: 18px; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border-default, #e4e4e7); background: var(--surface-base, #fff); cursor: pointer; color: var(--text-secondary, #6b6b70); font-size: 14px; }
    .fm-modal-head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
    .fm-ava-lg { width: 64px; height: 64px; border-radius: 16px; font-size: 22px; }
    .fm-modal-name { font-size: 22px; font-weight: 800; margin: 0 0 6px; }
    .fm-modal-meta { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; color: var(--text-secondary, #6b6b70); }
    .fm-tag { background: var(--accent-primary, #e30613); color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
    .fm-bio { font-size: 14px; line-height: 1.6; color: var(--text-secondary, #6b6b70); margin: 0 0 20px; }
    .fm-modal-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .fm-modal-stats > div { background: var(--surface-subtle, #fafafa); border: 1px solid var(--border-subtle, #eee); border-radius: 10px; padding: 14px; text-align: center; }
    .fm-modal-stats strong { display: block; font-size: 22px; font-weight: 800; color: var(--accent-primary, #e30613); }
    .fm-modal-stats span { font-size: 11px; color: var(--text-tertiary, #9a9aa0); text-transform: uppercase; letter-spacing: 0.5px; }
    .fm-modal-sub { font-size: 14px; font-weight: 700; margin: 0 0 12px; }
    .fm-hist { display: flex; flex-direction: column; gap: 8px; }
    .fm-hist-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--surface-subtle, #fafafa); border-radius: 10px; }
    .fm-hist-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .fm-hist-info { flex: 1; min-width: 0; }
    .fm-hist-title { font-weight: 600; font-size: 14px; }
    .fm-hist-meta { font-size: 12px; color: var(--text-tertiary, #9a9aa0); margin-top: 2px; }
    .fm-hist-status { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; }
    .status-approved { background: #ecfdf5; color: #047857; }
    .status-pending { background: #fffbeb; color: #b45309; }
    .status-rejected { background: #fef2f2; color: #b91c1c; }
    .fm-hist-count { font-size: 12px; color: var(--text-secondary, #6b6b70); white-space: nowrap; }
  `]
})
export class FormateursComponent implements OnInit {
  private api = inject(ApiService);

  loading = false;
  search = '';
  formateurs: FormateurStat[] = [];
  selected: FormateurStat | null = null;

  private allRegs: any[] = [];
  /** Tous les comptes : alimente les effectifs de la barre de navigation. */
  private allUsers: any[] = [];

  ngOnInit(): void { this.load(); }

  /** Effectifs affichés sur les cartes de la barre de navigation. */
  get roleCounts(): Record<string, number> {
    const count = (r: string) => this.allUsers.filter(u => (u.role || 'PARTICIPANT').toUpperCase() === r).length;
    return {
      participant: count('PARTICIPANT'),
      formateur: count('ORGANISATEUR'),
      admin: count('ADMIN')
    };
  }

  get filtered(): FormateurStat[] {
    const q = this.search.toLowerCase().trim();
    if (!q) return this.formateurs;
    return this.formateurs.filter(f =>
      `${f.user.firstName} ${f.user.lastName} ${f.user.email} ${f.user.department || ''}`.toLowerCase().includes(q));
  }

  get totalFormations(): number { return this.formateurs.reduce((s, f) => s + f.formations, 0); }
  get totalInscriptions(): number { return this.formateurs.reduce((s, f) => s + f.inscriptions, 0); }
  get globalPresence(): number {
    const ins = this.totalInscriptions;
    if (!ins) return 0;
    const pres = this.formateurs.reduce((s, f) => s + f.presents, 0);
    return Math.round((pres / ins) * 100);
  }

  load(): void {
    this.loading = true;
    Promise.all([
      this.api.getAllUsers().toPromise(),
      this.api.getAllEvents().toPromise(),
      this.api.getAllRegistrations().toPromise()
    ]).then(([users, events, regs]) => {
      this.allRegs = regs || [];
      this.allUsers = users || [];
      const organisateurs = this.allUsers.filter((u: any) => (u.role || '').toUpperCase() === 'ORGANISATEUR');
      this.formateurs = organisateurs.map((u: any) => this.buildStat(u, events || []));
      this.formateurs.sort((a, b) => b.formations - a.formations);
      this.loading = false;
    }).catch(() => { this.loading = false; });
  }

  private buildStat(u: any, events: any[]): FormateurStat {
    const ids = [String(u.keycloakId), String(u.id)];
    const evs = events.filter(e => ids.includes(String(e.organizerId)))
      .sort((a, b) => new Date(b.eventDate || 0).getTime() - new Date(a.eventDate || 0).getTime());
    const evIds = new Set(evs.map(e => e.id));
    const confirmed = this.allRegs.filter(r => evIds.has(r.eventId) && r.status === 'CONFIRMED');
    const presents = confirmed.filter(r => r.checkedIn).length;
    const now = Date.now();
    const upcoming = evs.filter(e => new Date(e.eventDate || 0).getTime() > now)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    return {
      user: u,
      events: evs,
      formations: evs.length,
      inscriptions: confirmed.length,
      presents,
      presenceRate: confirmed.length ? Math.round((presents / confirmed.length) * 100) : 0,
      nextSession: upcoming[0] || null
    };
  }

  countInscrits(e: any): number {
    return this.allRegs.filter(r => r.eventId === e.id && r.status === 'CONFIRMED').length;
  }

  open(f: FormateurStat): void { this.selected = f; }

  initials(u: any): string {
    return ((u.firstName || 'F')[0] + (u.lastName || '?')[0]).toUpperCase();
  }

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
  catColor(cat: string): string { return categoryColor(cat); }
}
