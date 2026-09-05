import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

/** Onglet de la section « Gestion des personnes ». */
export interface PeopleTab {
  key: 'participant' | 'formateur' | 'admin';
  /** Rôle backend correspondant (ORGANISATEUR = formateur). */
  role: string;
  label: string;
  desc: string;
  path: string;
  query: Record<string, any> | null;
}

export const PEOPLE_TABS: PeopleTab[] = [
  { key: 'participant', role: 'PARTICIPANT', label: 'Participants', desc: 'Apprenants inscrits', path: '/users', query: { role: 'participant' } },
  { key: 'formateur', role: 'ORGANISATEUR', label: 'Formateurs', desc: 'Animateurs des sessions', path: '/formateurs', query: null },
  { key: 'admin', role: 'ADMIN', label: 'Administrateurs', desc: 'Accès à la console', path: '/users', query: { role: 'admin' } }
];

/**
 * Barre de navigation de la section « Gestion des personnes ».
 *
 * Partagée par la liste des comptes (`/users`) et le suivi des formateurs
 * (`/formateurs`) : chaque population a sa propre page, la barre reste identique
 * d'un onglet à l'autre.
 */
@Component({
  selector: 'app-people-nav',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav class="pn" aria-label="Type de personne">
      <a class="pn-card" *ngFor="let t of tabs"
         [routerLink]="t.path" [queryParams]="t.query"
         [class.active]="active === t.key"
         [attr.aria-current]="active === t.key ? 'page' : null">
        <span class="pn-ico">
          <!-- Participant : apprenant -->
          <svg *ngIf="t.key === 'participant'" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="6.4" r="3.4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3.2 17c0-3.4 3-6.2 6.8-6.2s6.8 2.8 6.8 6.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <!-- Formateur : anime devant un tableau -->
          <svg *ngIf="t.key === 'formateur'" viewBox="0 0 20 20" fill="none">
            <rect x="7.4" y="2.6" width="10.2" height="7.4" rx="1.4" stroke="currentColor" stroke-width="1.4"/>
            <path d="M10 5.4h4.6M10 7.6h2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="5" cy="11.2" r="2.3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M1.4 17.6c0-2.2 1.6-3.8 3.6-3.8s3.6 1.6 3.6 3.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <!-- Administrateur : privilèges -->
          <svg *ngIf="t.key === 'admin'" viewBox="0 0 20 20" fill="none">
            <path d="M10 2.2l6.4 2.3v4.6c0 4-2.7 7.5-6.4 8.7-3.7-1.2-6.4-4.7-6.4-8.7V4.5L10 2.2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M7.2 10l2 2 3.6-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span class="pn-txt">
          <span class="pn-label">{{ t.label }}</span>
          <span class="pn-desc">{{ t.desc }}</span>
        </span>
        <span class="pn-count">{{ counts[t.key] || 0 }}</span>
      </a>
    </nav>
  `,
  styles: [`
    .pn { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 22px; }
    @media (max-width: 980px) { .pn { grid-template-columns: 1fr; } }

    .pn-card {
      position: relative; overflow: hidden;
      display: flex; align-items: center; gap: 14px;
      padding: 15px 16px;
      background: var(--surface-base, #fff);
      border: 1px solid var(--border-subtle, #eee);
      border-radius: 14px;
      text-decoration: none; color: inherit;
      transition: border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
    }
    .pn-card:hover {
      border-color: var(--border-default, #e4e4e7);
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.05);
    }
    .pn-card:focus-visible { outline: 2px solid var(--accent-primary, #e30613); outline-offset: 2px; }
    .pn-card.active {
      border-color: var(--accent-primary, #e30613);
      box-shadow: 0 8px 22px rgba(227, 6, 19, 0.14);
    }
    .pn-card.active::after {
      content: ''; position: absolute; left: 0; right: 0; bottom: 0;
      height: 3px; background: var(--accent-primary, #e30613);
    }

    .pn-ico {
      width: 42px; height: 42px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      border-radius: 12px;
      background: var(--surface-muted, #f1f1f3);
      color: var(--text-secondary, #6b6b70);
      transition: background 0.16s ease, color 0.16s ease;
    }
    .pn-ico svg { width: 20px; height: 20px; }
    .pn-card.active .pn-ico { background: var(--accent-primary-soft, #fdeceb); color: var(--accent-primary, #e30613); }

    .pn-txt { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
    .pn-label { font-size: 14.5px; font-weight: 700; letter-spacing: -0.2px; color: var(--text-primary, #18181b); }
    .pn-desc {
      font-size: 12px; color: var(--text-tertiary, #9a9aa0);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .pn-count {
      flex-shrink: 0;
      min-width: 32px; height: 26px; padding: 0 9px;
      display: flex; align-items: center; justify-content: center;
      border-radius: 13px;
      background: var(--surface-muted, #f1f1f3);
      color: var(--text-secondary, #6b6b70);
      font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums;
      transition: background 0.16s ease, color 0.16s ease;
    }
    .pn-card.active .pn-count { background: var(--accent-primary, #e30613); color: #fff; }
  `]
})
export class PeopleNavComponent {
  readonly tabs = PEOPLE_TABS;

  /** Onglet en cours. */
  @Input() active: PeopleTab['key'] = 'participant';

  /** Effectifs affichés sur chaque carte. */
  @Input() counts: Record<string, number> = {};
}
