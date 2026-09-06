import { Component, OnInit, inject, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { KeycloakService } from 'keycloak-angular';
import { GeoService } from '../../services/geo.service';
import { CATEGORIES, categoryColor, categoryGradient } from '../../shared/categories';
import {
  certificateLabel, certificateMessage, certificateTone,
  progressLabel, progressTone
} from '../../shared/participation';
import { NotifsService } from '../../services/notifs.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-user',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="usr">

      <!-- ─── TOP BAR ─── -->
      <header class="usr-topbar">
        <div class="usr-topbar-l">
          <div class="usr-brand">Catalogue</div>
          <span class="usr-status">
            <span class="usr-status-dot"></span>
            <span>{{ filteredEvents.length }} événement(s)</span>
          </span>
        </div>
        <div class="usr-topbar-r">
          <button class="usr-tab-pill" [class.active]="activeTab==='discover'" (click)="activeTab='discover'">
            <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M11 5L9.2 9.2 5 11l1.8-4.2L11 5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            Catalogue
          </button>
          <button class="usr-tab-pill" [class.active]="activeTab==='planning'" (click)="activeTab='planning'">
            <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Planning
          </button>
          <button class="usr-tab-pill" [class.active]="activeTab==='wallet'" (click)="activeTab='wallet'; loadMyRegistrations()">
            <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="4" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 7h12" stroke="currentColor" stroke-width="1.5"/></svg>
            Mes inscriptions
            <span class="pill-badge" *ngIf="myRegistrations.length">{{ myRegistrations.length }}</span>
          </button>
        </div>
      </header>

      <!-- ════════════════════ DISCOVER ════════════════════ -->
      <ng-container *ngIf="activeTab==='discover'">

        <!-- Hero + recherche -->
        <header class="cat-hero">
          <div class="cat-hero-txt">
            <h1 class="cat-h1">Catalogue de formations</h1>
            <p class="cat-sub">Formations certifiantes, workshops et conférences — LINSOFT Learning Center.</p>
          </div>
          <div class="cat-search">
            <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <input [(ngModel)]="searchText" (input)="filterEvents()" placeholder="Rechercher une formation, un thème, un lieu…">
            <button *ngIf="searchText" class="search-clear" (click)="searchText=''; filterEvents()">✕</button>
          </div>
        </header>

        <!-- Onglets par type (icône + compteurs dynamiques) -->
        <div class="type-tabs">
          <button [class.on]="typeFilter===''" (click)="setTypeFilter('')">
            <svg class="tt-ico" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.4"/></svg>
            Tout <span class="tt-n">{{ events.length }}</span>
          </button>
          <button [class.on]="typeFilter==='FORMATION'" (click)="setTypeFilter('FORMATION')">
            <svg class="tt-ico" viewBox="0 0 16 16" fill="none"><path d="M8 2L1 5l7 3 7-3-7-3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 6.5V10c0 1 1.8 1.8 4 1.8s4-.8 4-1.8V6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Formations <span class="tt-n">{{ countType('FORMATION') }}</span>
          </button>
          <button [class.on]="typeFilter==='WORKSHOP'" (click)="setTypeFilter('WORKSHOP')">
            <svg class="tt-ico" viewBox="0 0 16 16" fill="none"><path d="M9.5 3.5a2.5 2.5 0 0 1 3 3l-6 6-3 .5.5-3 5.5-6.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            Workshops <span class="tt-n">{{ countType('WORKSHOP') }}</span>
          </button>
          <button [class.on]="typeFilter==='CONFERENCE'" (click)="setTypeFilter('CONFERENCE')">
            <svg class="tt-ico" viewBox="0 0 16 16" fill="none"><rect x="6" y="2" width="4" height="7" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M4 7a4 4 0 0 0 8 0M8 11v3M6 14h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Conférences <span class="tt-n">{{ countType('CONFERENCE') }}</span>
          </button>
        </div>

        <!-- Filtres secondaires -->
        <div class="cat-filters">
          <select [(ngModel)]="activeCategory" (change)="filterEvents()" class="cf-select">
            <option value="">Toutes les catégories</option>
            <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
          </select>
          <select [(ngModel)]="levelFilter" (change)="filterEvents()" class="cf-select">
            <option value="">Tous niveaux</option>
            <option value="Débutant">Débutant</option>
            <option value="Intermédiaire">Intermédiaire</option>
            <option value="Avancé">Avancé</option>
          </select>
          <select [(ngModel)]="modeFilter" (change)="filterEvents()" class="cf-select">
            <option value="">Tous formats</option>
            <option value="PRESENTIEL">Présentiel</option>
            <option value="EN_LIGNE">En ligne</option>
            <option value="HYBRIDE">Hybride</option>
          </select>
          <select [(ngModel)]="sortBy" (change)="filterEvents()" class="cf-select">
            <option value="date-asc">Date ↑</option>
            <option value="date-desc">Date ↓</option>
            <option value="seats-desc">Plus de places</option>
          </select>
          <button *ngIf="activeFiltersCount > 0" class="cf-reset" (click)="resetFilters()">Réinitialiser ({{ activeFiltersCount }})</button>
          <div class="cf-spacer"></div>
          <div class="view-toggle">
            <button [class.active]="viewMode==='list'" (click)="setView('list')">
              <svg viewBox="0 0 16 16" fill="none"><path d="M5 4h9M5 8h9M5 12h9M2 4h.01M2 8h.01M2 12h.01" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
              Liste
            </button>
            <button [class.active]="viewMode==='map'" (click)="setView('map')">
              <svg viewBox="0 0 16 16" fill="none"><path d="M6 2L2 4v10l4-2 4 2 4-2V2l-4 2-4-2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M6 2v10M10 4v10" stroke="currentColor" stroke-width="1.4"/></svg>
              Carte
            </button>
          </div>
        </div>

        <div class="cat-count" *ngIf="viewMode==='list' && !loadingEvents">
          <strong>{{ filteredEvents.length }}</strong> session(s) disponible(s)
        </div>

        <!-- MAP VIEW -->
        <section *ngIf="viewMode==='map'" class="map-section">
          <div id="events-map" class="events-map"></div>
          <div class="map-hint">
            <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Cliquez sur un marqueur pour voir l'événement · {{ filteredEvents.length }} événement(s)
          </div>
        </section>

        <!-- Advanced filters panel -->
        <section *ngIf="filtersOpen" class="adv-filters">
          <div class="af-group">
            <label class="af-label">Catégorie</label>
            <div class="cat-chips">
              <button class="cat-pill" [class.active]="activeCategory===''" (click)="setCategory('')">Toutes</button>
              <button *ngFor="let c of categories" class="cat-pill" [class.active]="activeCategory===c" (click)="setCategory(c)">{{ c }}</button>
            </div>
          </div>
          <div class="af-group">
            <label class="af-label">À partir du</label>
            <input type="date" [(ngModel)]="dateFrom" (change)="filterEvents()" class="af-date">
          </div>
          <div class="af-actions">
            <button class="af-reset" (click)="resetFilters()">Réinitialiser</button>
          </div>
        </section>

        <!-- Loading skeleton -->
        <div *ngIf="viewMode==='list' && loadingEvents" class="grid-events">
          <div class="event-skel" *ngFor="let _ of [1,2,3,4,5,6]">
            <div class="skel-img"></div>
            <div class="skel-line skel-line-1"></div>
            <div class="skel-line skel-line-2"></div>
          </div>
        </div>

        <!-- Empty -->
        <div *ngIf="viewMode==='list' && !loadingEvents && filteredEvents.length === 0" class="empty">
          <div class="empty-glyph">
            <svg viewBox="0 0 64 64" fill="none"><circle cx="28" cy="28" r="18" stroke="currentColor" stroke-width="2"/><path d="M41 41l10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </div>
          <div class="empty-title">Aucun événement trouvé</div>
          <div class="empty-desc">Modifiez vos filtres ou réinitialisez la recherche.</div>
          <button class="btn-secondary" (click)="resetFilters()">Réinitialiser tous les filtres</button>
        </div>

        <!-- Events grid -->
        <section class="section" *ngIf="viewMode==='list' && !loadingEvents && filteredEvents.length > 0">
          <div class="grid-events">
            <article class="event-card" *ngFor="let ev of filteredEvents" (click)="openDetails(ev)">
              <span class="ec-accent" [style.background]="categoryColorOf(ev.category)"></span>
              <div class="event-card-head">
                <span class="ec-type ec-type-{{ (ev.type || 'evenement') | lowercase }}">{{ typeLabel(ev) }}</span>
                <span class="ec-cat" *ngIf="ev.category">{{ ev.category }}</span>
                <span class="event-reserved-badge" *ngIf="reservedSet.has(ev.id)">✓ Inscrit</span>
              </div>

              <div class="event-card-body">
                <h3 class="event-card-title">{{ ev.title }}</h3>
                <div class="ec-tags" *ngIf="ev.level || ev.duration || ev.certification || ev.speaker">
                  <span class="ec-tag" *ngIf="ev.level">{{ ev.level }}</span>
                  <span class="ec-tag" *ngIf="ev.duration">{{ ev.duration }}</span>
                  <span class="ec-tag ec-tag-cert" *ngIf="ev.certification">★ {{ ev.certification }}</span>
                  <span class="ec-tag" *ngIf="ev.speaker">{{ ev.speaker }}</span>
                </div>
                <div class="event-card-meta">
                  <span><svg viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 5h10M5 1.5v2M9 1.5v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>{{ ev.eventDate | date:'dd MMM, HH:mm' }}</span>
                  <span class="event-dot">·</span>
                  <span>{{ ev.location || modeLabel(ev) }}</span>
                </div>

                <div class="event-card-seats" *ngIf="ev.totalSeats">
                  <div class="seats-track">
                    <div class="seats-fill" [style.width]="getSeatsPct(ev) + '%'"></div>
                  </div>
                  <span class="seats-text">{{ ev.availableSeats ?? ev.totalSeats }} / {{ ev.totalSeats }} places</span>
                </div>

                <div class="event-card-footer">
                  <div class="event-format">{{ modeLabel(ev) }}</div>
                  <button class="event-cta" (click)="openDetails(ev); $event.stopPropagation()">
                    {{ reservedSet.has(ev.id) ? 'Voir' : 'Voir détails' }}
                    <svg viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>
              </div>
            </article>
          </div>
        </section>
      </ng-container>

      <!-- ════════════════════ PLANNING ════════════════════ -->
      <ng-container *ngIf="activeTab==='planning'">
        <header class="cat-head">
          <h1 class="cat-h1">Planning des sessions</h1>
          <p class="cat-sub">Toutes les sessions à venir, organisées par mois. Participez à celles qui vous intéressent.</p>
        </header>

        <div class="pl-toolbar">
          <div class="segmented">
            <button [class.active]="planningMode===''" (click)="planningMode=''">Toutes</button>
            <button [class.active]="planningMode==='presentiel'" (click)="planningMode='presentiel'">Présentiel</button>
            <button [class.active]="planningMode==='enligne'" (click)="planningMode='enligne'">En ligne</button>
          </div>
        </div>

        <div *ngIf="sessionsByMonth.length === 0" class="empty">
          <div class="empty-glyph"><svg viewBox="0 0 64 64" fill="none"><rect x="8" y="12" width="48" height="44" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 24h48M20 6v12M44 6v12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
          <div class="empty-title">Aucune session planifiée</div>
          <div class="empty-desc">Les prochaines sessions apparaîtront ici dès leur publication.</div>
        </div>

        <div class="pl-month" *ngFor="let g of sessionsByMonth">
          <div class="pl-month-head">
            <span class="pl-month-name">{{ g.date | date:'MMMM yyyy' }}</span>
            <span class="pl-month-count">{{ g.items.length }} session(s)</span>
          </div>
          <div class="pl-table">
            <div class="pl-row" *ngFor="let e of g.items" (click)="openDetails(e)">
              <div class="pl-date">
                <span class="pl-d">{{ e.eventDate | date:'dd' }}</span>
                <span class="pl-m">{{ e.eventDate | date:'EEE' }}</span>
              </div>
              <div class="pl-info">
                <div class="pl-title">{{ e.title }}</div>
                <div class="pl-meta">
                  <span class="pl-cat-dot" [style.background]="categoryColorOf(e.category)"></span>
                  {{ e.category }} · {{ typeLabel(e) }} · {{ modeLabel(e) }} · {{ e.eventDate | date:'HH:mm' }}
                </div>
              </div>
              <div class="pl-seats">{{ e.availableSeats ?? e.totalSeats }}/{{ e.totalSeats }} places</div>
              <button class="pl-cta" *ngIf="!reservedSet.has(e.id)" (click)="openDetails(e); $event.stopPropagation()">Participer</button>
              <span class="pl-done" *ngIf="reservedSet.has(e.id)">✓ Inscrit</span>
            </div>
          </div>
        </div>
      </ng-container>

      <!-- ════════════════════ WALLET ════════════════════ -->
      <ng-container *ngIf="activeTab==='wallet'">
        <div class="wallet-head">
          <div>
            <h1 class="wallet-h1">Mes inscriptions</h1>
            <p class="wallet-sub">Suivez votre progression session par session et l'état de vos certificats.</p>
          </div>
          <div class="wallet-stats">
            <div class="wallet-stat"><div class="wallet-stat-v">{{ activeTickets }}</div><div class="wallet-stat-l">En cours</div></div>
            <div class="wallet-stat"><div class="wallet-stat-v">{{ completedCount }}</div><div class="wallet-stat-l">Terminées</div></div>
            <div class="wallet-stat wallet-stat-cert"><div class="wallet-stat-v">{{ certificatesReady }}</div><div class="wallet-stat-l">Certificats</div></div>
          </div>
        </div>

        <!-- Bandeau : certificats fraîchement délivrés -->
        <div class="wallet-alert wallet-alert-ok" *ngIf="certificatesReady > 0">
          <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M6.5 10l2.4 2.4L13.5 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span><strong>{{ certificatesReady }}</strong> certificat(s) de participation disponible(s) au téléchargement.</span>
        </div>
        <!-- Bandeau : certificats en cours de traitement -->
        <div class="wallet-alert wallet-alert-info" *ngIf="certificatesPreparing > 0">
          <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.6"/><path d="M10 6v4.3l2.6 1.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          <span><strong>{{ certificatesPreparing }}</strong> certificat(s) en cours de préparation — vous serez prévenu(e) dès leur mise à disposition.</span>
        </div>

        <div *ngIf="myRegistrations.length === 0" class="empty">
          <div class="empty-glyph"><svg viewBox="0 0 64 64" fill="none"><rect x="8" y="20" width="48" height="32" rx="4" stroke="currentColor" stroke-width="2"/><path d="M8 30h48M22 12v8M42 12v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></div>
          <div class="empty-title">Aucune inscription pour le moment</div>
          <div class="empty-desc">Explorez le catalogue et inscrivez-vous à votre première formation.</div>
          <button class="btn-primary-lg" (click)="activeTab='discover'">Explorer le catalogue →</button>
        </div>

        <div class="reg-list" *ngIf="myRegistrations.length > 0">
          <article class="reg-item" *ngFor="let reg of myRegistrations"
                   [class.reg-cancelled]="reg.status==='CANCELLED' || reg.status==='REJECTED'"
                   [class.reg-done]="reg.progressStatus==='COMPLETED'">

            <div class="reg-top">
              <!-- Bloc date -->
              <div class="reg-date">
                <span class="reg-d">{{ regDate(reg) ? (regDate(reg) | date:'dd') : '—' }}</span>
                <span class="reg-mo">{{ regDate(reg) ? (regDate(reg) | date:'MMM') : '' }}</span>
              </div>

              <!-- Infos -->
              <div class="reg-main">
                <div class="reg-title-row">
                  <h3 class="reg-title">{{ regTitle(reg) }}</h3>
                  <span class="reg-status"
                        [class.st-ok]="reg.status==='CONFIRMED'"
                        [class.st-pending]="reg.status==='PENDING'"
                        [class.st-cancel]="reg.status==='CANCELLED' || reg.status==='REJECTED'">
                    <span class="reg-status-dot"></span>{{ regStatusLabel(reg.status) }}
                  </span>
                  <span class="badge badge-{{ progressToneOf(reg) }}" *ngIf="reg.status==='CONFIRMED'">
                    {{ progressLabelOf(reg) }}
                  </span>
                </div>
                <div class="reg-meta">
                  <span>
                    <svg viewBox="0 0 14 14" fill="none"><rect x="2" y="2.5" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M2 5h10M5 1.5v2M9 1.5v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
                    {{ (regDate(reg) | date:'EEE dd MMM yyyy · HH:mm') || 'Date à confirmer' }}
                  </span>
                  <span class="reg-dot" *ngIf="getEvent(reg.eventId)">·</span>
                  <span *ngIf="getEvent(reg.eventId)">{{ typeLabel(getEvent(reg.eventId)) }} · {{ modeLabel(getEvent(reg.eventId)) }}</span>
                  <span class="reg-dot">·</span>
                  <span>{{ reg.eventLocation || getEvent(reg.eventId)?.location || modeLabel(getEvent(reg.eventId)) }}</span>
                </div>
                <div class="reg-ref">Référence #{{ shortId(reg.id) }}</div>
              </div>

              <!-- Actions -->
              <div class="reg-actions">
                <button class="reg-btn reg-btn-ghost" (click)="openRegDetails(reg)">Voir les détails</button>
                <button *ngIf="reg.status==='CONFIRMED' && reg.progressStatus!=='COMPLETED'" class="reg-btn reg-btn-danger" (click)="cancelReg(reg.id)">Annuler</button>
              </div>
            </div>

            <!-- ─── Avancement dans la session ─── -->
            <div class="track" *ngIf="reg.status==='CONFIRMED'">
              <div class="track-head">
                <span class="track-label">Votre progression</span>
                <span class="track-pct">{{ reg.progressPercent || 0 }}%</span>
              </div>
              <div class="track-bar">
                <div class="track-fill" [class.track-fill-done]="reg.progressStatus==='COMPLETED'"
                     [style.width]="(reg.progressPercent || 0) + '%'"></div>
              </div>

              <ol class="track-steps">
                <li class="track-step" *ngFor="let s of reg.steps"
                    [class.on]="s.done" [class.missed]="s.missed">
                  <span class="track-dot">
                    <svg *ngIf="s.done" viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2l2.3 2.3L9.5 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    <svg *ngIf="!s.done && s.missed" viewBox="0 0 12 12" fill="none"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </span>
                  <span class="track-step-label">{{ s.label }}</span>
                  <span class="track-step-note" *ngIf="s.missed">Non validée</span>
                </li>
              </ol>

              <div class="track-end" *ngIf="reg.progressStatus==='COMPLETED'">
                Session terminée le {{ (reg.completedAt || reg.eventEndDateStr) | date:'dd MMM yyyy · HH:mm' }}
              </div>
              <div class="track-end" *ngIf="reg.progressStatus==='IN_PROGRESS' && reg.eventEndDateStr">
                Fin prévue le {{ reg.eventEndDateStr | date:'dd MMM yyyy · HH:mm' }}
              </div>
            </div>

            <!-- ─── Certificat de participation ─── -->
            <div class="cert" *ngIf="reg.status==='CONFIRMED'" [attr.data-tone]="certificateToneOf(reg)">
              <div class="cert-ico">
                <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7.5" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M7.2 11.4L6 18l4-2 4 2-1.2-6.6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.2 7.4l1.3 1.3 2.4-2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div class="cert-body">
                <div class="cert-head">
                  <span class="cert-title">Certificat</span>
                  <span class="badge badge-{{ certificateToneOf(reg) }}">{{ certificateLabelOf(reg) }}</span>
                </div>
                <p class="cert-msg">{{ certificateMessageOf(reg) }}</p>
                <div class="cert-sent" *ngIf="reg.certificateSentAt">
                  Délivré le {{ reg.certificateSentAt | date:'dd MMM yyyy' }}
                </div>
              </div>
              <button class="cert-btn" *ngIf="reg.certificateDownloadable"
                      (click)="downloadCertificate(reg)" [disabled]="certBusy === reg.id">
                <svg viewBox="0 0 16 16" fill="none"><path d="M8 2v8M4.8 7.2L8 10.4l3.2-3.2M3 12.5h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                {{ certBusy === reg.id ? 'Téléchargement…' : 'Télécharger le PDF' }}
              </button>
            </div>
          </article>
        </div>
      </ng-container>


      <!-- ════════════════════ MODAL DÉTAILS ÉVÉNEMENT ════════════════════ -->
      <div *ngIf="selectedEvent" class="modal-overlay" (click)="closeDetails()">
        <div class="modal-event" (click)="$event.stopPropagation()">
          <button class="modal-close" (click)="closeDetails()" title="Fermer (Esc)">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>

          <div class="modal-banner" [style.background]="catGradient(selectedEvent.category)">
            <div class="modal-banner-shade"></div>
            <div class="modal-banner-content">
              <span class="modal-cat" *ngIf="selectedEvent.category">{{ selectedEvent.category }}</span>
              <h2 class="modal-title">{{ selectedEvent.title }}</h2>
              <div class="modal-banner-meta">
                <span><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 7h12" stroke="currentColor" stroke-width="1.5"/></svg>{{ selectedEvent.eventDate | date:'EEEE d MMMM yyyy' }}</span>
                <span><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>{{ selectedEvent.eventDate | date:'HH:mm' }}</span>
              </div>
            </div>
          </div>

          <div class="modal-body">
            <div class="modal-grid">
              <div class="modal-main">
                <!-- Délai avant la session (sobre, sans urgence) -->
                <div class="cd-soft" *ngIf="!countdown.past">
                  <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  <span *ngIf="countdown.days > 1">Débute dans {{ countdown.days }} jours</span>
                  <span *ngIf="countdown.days === 1">Débute demain</span>
                  <span *ngIf="countdown.days === 0">Débute aujourd'hui à {{ selectedEvent.eventDate | date:'HH:mm' }}</span>
                </div>
                <div class="cd-past" *ngIf="countdown.past">
                  <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Cette session a déjà eu lieu
                </div>

                <h3 class="modal-section-title">À propos de cet événement</h3>
                <p class="modal-desc">{{ selectedEvent.description || 'Aucune description détaillée pour cet événement. Contactez l\\'organisateur pour plus d\\'informations.' }}</p>

                <h3 class="modal-section-title">Informations pratiques</h3>
                <div class="modal-info-grid">
                  <div class="modal-info-card">
                    <div class="mi-ico" style="background:#ecebff;color:#e30613"><svg viewBox="0 0 20 20" fill="none"><path d="M10 18s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10z" stroke="currentColor" stroke-width="1.8"/><circle cx="10" cy="8" r="2" stroke="currentColor" stroke-width="1.8"/></svg></div>
                    <div>
                      <div class="mi-label">Lieu</div>
                      <div class="mi-value">{{ selectedEvent.location || 'À définir' }}</div>
                    </div>
                  </div>
                  <div class="modal-info-card">
                    <div class="mi-ico" style="background:#ecfdf5;color:#10b981"><svg viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="11" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M7 17h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
                    <div>
                      <div class="mi-label">Format</div>
                      <div class="mi-value">{{ typeLabel(selectedEvent) }} · {{ modeLabel(selectedEvent) }}</div>
                    </div>
                  </div>
                  <div class="modal-info-card">
                    <div class="mi-ico" style="background:#fef3c7;color:#f59e0b"><svg viewBox="0 0 20 20" fill="none"><circle cx="7" cy="8" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="8" r="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M2 17c0-3 2-5 5-5s5 2 5 5M12 17c0-2.5 2-4 4-4s3.5 1.5 3.5 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></div>
                    <div>
                      <div class="mi-label">Capacité</div>
                      <div class="mi-value">{{ selectedEvent.totalSeats || '—' }} places</div>
                    </div>
                  </div>
                  <div class="modal-info-card">
                    <div class="mi-ico" style="background:#cffafe;color:#06b6d4"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.8"/><path d="M6 10l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                    <div>
                      <div class="mi-label">Disponibilité</div>
                      <div class="mi-value">{{ selectedEvent.availableSeats ?? selectedEvent.totalSeats }} places restantes</div>
                    </div>
                  </div>
                </div>

                <!-- Détails spécifiques au type de session -->
                <div class="sess-spec" *ngIf="selectedEvent.certification || selectedEvent.level || selectedEvent.duration || selectedEvent.speaker || selectedEvent.prerequisites">
                  <span class="ss-item" *ngIf="selectedEvent.certification"><strong>Certification</strong>{{ selectedEvent.certification }}</span>
                  <span class="ss-item" *ngIf="selectedEvent.level"><strong>Niveau</strong>{{ selectedEvent.level }}</span>
                  <span class="ss-item" *ngIf="selectedEvent.duration"><strong>Durée</strong>{{ selectedEvent.duration }}</span>
                  <span class="ss-item" *ngIf="selectedEvent.speaker"><strong>Intervenant</strong>{{ selectedEvent.speaker }}</span>
                  <span class="ss-item ss-full" *ngIf="selectedEvent.prerequisites"><strong>Prérequis</strong>{{ selectedEvent.prerequisites }}</span>
                </div>

                <!-- Accès en ligne (visio) pour les sessions en ligne / hybride -->
                <div *ngIf="modeLabel(selectedEvent) !== 'Présentiel'" class="visio-block">
                  <div class="visio-ico">
                    <svg viewBox="0 0 20 20" fill="none"><rect x="2" y="5" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M13 9l5-3v8l-5-3" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
                  </div>
                  <div class="visio-info">
                    <div class="visio-label">Session {{ modeLabel(selectedEvent) | lowercase }}</div>
                    <ng-container *ngIf="reservedSet.has(selectedEvent.id); else visioLocked">
                      <a *ngIf="selectedEvent.visioLink" class="visio-link" [href]="selectedEvent.visioLink" target="_blank" rel="noopener">Rejoindre la visioconférence →</a>
                      <span *ngIf="!selectedEvent.visioLink" class="visio-muted">Le lien de connexion sera communiqué avant la session.</span>
                    </ng-container>
                    <ng-template #visioLocked>
                      <span class="visio-muted">Inscrivez-vous pour accéder au lien de connexion.</span>
                    </ng-template>
                  </div>
                </div>

                <!-- Carte localisation -->
                <h3 class="modal-section-title" *ngIf="modeLabel(selectedEvent) !== 'En ligne'">Localisation</h3>
                <div class="modal-map-wrap" *ngIf="modeLabel(selectedEvent) !== 'En ligne'">
                  <div id="modal-map" class="modal-map"></div>
                  <div class="modal-map-addr">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M8 14s5-4.5 5-8a5 5 0 1 0-10 0c0 3.5 5 8 5 8z" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6" r="1.8" stroke="currentColor" stroke-width="1.5"/></svg>
                    {{ selectedEvent.location || 'Lieu à définir' }}
                  </div>
                </div>

                <div class="modal-seats" *ngIf="selectedEvent.totalSeats">
                  <div class="ms-head">
                    <span class="ms-label">Taux de remplissage</span>
                    <span class="ms-pct">{{ getSeatsPct(selectedEvent) }}%</span>
                  </div>
                  <div class="ms-bar">
                    <div class="ms-fill" [style.width]="getSeatsPct(selectedEvent) + '%'"></div>
                  </div>
                </div>

                <!-- Reviews section -->
                <h3 class="modal-section-title">
                  Avis & notes
                  <span class="reviews-rating-badge" *ngIf="avgRating > 0">
                    ★ {{ avgRating | number:'1.1-1' }} <span class="rr-sub">({{ reviews.length }})</span>
                  </span>
                </h3>

                <!-- Rate this event (only if has registered & event has passed or any time for demo) -->
                <div class="rate-box" *ngIf="canRateEvent()">
                  <div class="rate-title">Laissez votre avis</div>
                  <div class="star-input">
                    <button *ngFor="let i of [1,2,3,4,5]" (click)="newRating = i" [class.filled]="newRating >= i" class="star-btn">★</button>
                  </div>
                  <textarea [(ngModel)]="newComment" placeholder="Partagez votre expérience..." rows="2" class="rate-textarea"></textarea>
                  <button class="rate-submit" (click)="submitFeedback()" [disabled]="!newRating || submittingFeedback">
                    {{ submittingFeedback ? 'Envoi…' : 'Publier mon avis' }}
                  </button>
                </div>
                <div class="rate-info" *ngIf="!canRateEvent() && !hasReviewed">
                  <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Participez à la session pour pouvoir laisser un avis.
                </div>
                <div class="rate-info rate-info-success" *ngIf="hasReviewed">
                  <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Merci, vous avez déjà partagé votre avis.
                </div>

                <!-- Reviews list -->
                <div class="reviews-list" *ngIf="reviews.length > 0">
                  <div *ngFor="let r of reviews" class="review-item">
                    <div class="review-head">
                      <div class="review-ava">{{ initialsOf(r.userId) }}</div>
                      <div>
                        <div class="review-user">{{ r.userId | slice:0:8 }}…</div>
                        <div class="review-date">{{ r.createdAt | date:'dd MMM yyyy' }}</div>
                      </div>
                      <div class="review-stars">
                        <span *ngFor="let i of [1,2,3,4,5]" [class.filled]="r.rating >= i">★</span>
                      </div>
                    </div>
                    <p class="review-comment" *ngIf="r.comment">{{ r.comment }}</p>
                  </div>
                </div>
                <div *ngIf="reviews.length === 0 && !loadingReviews" class="reviews-empty">
                  Aucun avis pour le moment. Soyez le premier !
                </div>
              </div>

              <aside class="modal-side">
                <div class="modal-price-card">
                  <div class="mpc-head">
                    <span class="mpc-type">{{ typeLabel(selectedEvent) }}</span>
                    <span class="mpc-mode">{{ modeLabel(selectedEvent) }}</span>
                  </div>
                  <div class="mpc-avail">
                    <strong>{{ selectedEvent.availableSeats ?? selectedEvent.totalSeats }}</strong> place(s) restante(s)
                  </div>
                  <div class="mpc-divider"></div>

                  <button *ngIf="!reservedSet.has(selectedEvent.id) && !pendingSet.has(selectedEvent.id)" class="mpc-cta" (click)="register(selectedEvent.id)" [disabled]="registering === selectedEvent.id">
                    <span *ngIf="registering !== selectedEvent.id">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      Demander à participer
                    </span>
                    <span *ngIf="registering === selectedEvent.id">Envoi…</span>
                  </button>
                  <button *ngIf="pendingSet.has(selectedEvent.id)" class="mpc-cta mpc-cta-pending" disabled>
                    <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.6"/><path d="M8 5v3l2 1.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                    En attente de validation
                  </button>
                  <button *ngIf="reservedSet.has(selectedEvent.id)" class="mpc-cta mpc-cta-done" disabled>
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Vous êtes inscrit(e)
                  </button>

                  <button class="mpc-share" (click)="shareEvent(selectedEvent)">
                    <svg viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="3" r="2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="13" r="2" stroke="currentColor" stroke-width="1.6"/><path d="M6 7l4-3M6 9l4 3" stroke="currentColor" stroke-width="1.6"/></svg>
                    Partager
                  </button>

                  <div class="mpc-footer">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5 2v4c0 3-2 5.5-5 6.5-3-1-5-3.5-5-6.5v-4l5-2z" stroke="currentColor" stroke-width="1.5"/></svg>
                    Inscription gratuite · Validation par un administrateur
                  </div>
                </div>

                <div class="modal-share-tags">
                  <h4 class="mst-title">Tags</h4>
                  <div class="tag-list">
                    <span class="tag-chip">{{ selectedEvent.category || 'Événement' }}</span>
                    <span class="tag-chip">{{ selectedEvent.location || 'Lieu' }}</span>
                    <span class="tag-chip">{{ selectedEvent.eventDate | date:'MMMM' }}</span>
                  </div>
                </div>
              </aside>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div *ngIf="toast" class="toast" [class.toast-success]="toast.type==='success'" [class.toast-error]="toast.type==='error'">
        <div class="toast-icon">
          <svg *ngIf="toast.type==='success'" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <svg *ngIf="toast.type==='error'" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v5M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </div>
        <span>{{ toast.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    .usr { font-family: 'Inter', -apple-system, system-ui, sans-serif; color: var(--text-primary); padding-bottom: 80px; }
    .usr * { box-sizing: border-box; }

    /* Topbar */
    .usr-topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; margin-bottom: 24px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 12px; }
    .usr-topbar-l { display: flex; align-items: center; gap: 16px; }
    .usr-topbar-r { display: flex; gap: 4px; background: var(--surface-muted); border-radius: 10px; padding: 3px; }
    .usr-brand { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
    .usr-status { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; color: var(--text-tertiary); padding-left: 16px; border-left: 1px solid var(--border-default); }
    .usr-status-dot { width: 6px; height: 6px; background: var(--accent-success); border-radius: 50%; position: relative; }
    .usr-status-dot::after { content: ''; position: absolute; inset: -3px; background: var(--accent-success); border-radius: 50%; opacity: 0.3; animation: pulse 2s ease infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0; transform: scale(2); } }

    .usr-tab-pill { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: none; padding: 7px 14px; font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: 7px; font-family: inherit; transition: all 0.15s ease; }
    .usr-tab-pill svg { width: 14px; height: 14px; }
    .usr-tab-pill:hover { color: var(--text-primary); }
    .usr-tab-pill.active { background: var(--surface-base); color: var(--text-primary); box-shadow: var(--shadow-xs); }
    .pill-badge { font-size: 10px; padding: 1px 6px; background: var(--accent-primary); color: white; border-radius: 20px; font-weight: 700; margin-left: 2px; }

    /* Featured */
    .featured { position: relative; height: 480px; border-radius: 20px; overflow: hidden; margin-bottom: 32px; background: #1a1a1a; cursor: pointer; }
    .featured-img { position: absolute; inset: 0; background-size: cover; background-position: center; transition: transform 8s ease; }
    .featured:hover .featured-img { transform: scale(1.04); }
    .featured-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.2) 40%, rgba(0,0,0,0.85) 100%); }
    .featured-fav { position: absolute; top: 24px; right: 24px; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.4); backdrop-filter: blur(10px); border: none; cursor: pointer; z-index: 3; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .featured-fav:hover { background: rgba(0,0,0,0.6); transform: scale(1.1); }
    .featured-fav svg { width: 22px; height: 22px; }
    .featured-content { position: relative; height: 100%; z-index: 2; display: flex; flex-direction: column; justify-content: flex-end; padding: 40px 48px; color: white; max-width: 720px; }
    .featured-meta { display: inline-flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .featured-eyebrow { display: inline-flex; align-items: center; background: rgba(255,255,255,0.18); backdrop-filter: blur(12px); padding: 5px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; }
    .featured-cat { font-size: 12px; opacity: 0.85; font-weight: 500; }
    .featured-title { font-size: 40px; font-weight: 700; letter-spacing: -1.5px; line-height: 1.05; margin: 0 0 14px; }
    .featured-desc { font-size: 15px; line-height: 1.6; opacity: 0.85; margin: 0 0 24px; max-width: 600px; }
    .featured-info { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 28px; }
    .featured-info-item { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; opacity: 0.9; }
    .featured-info-item svg { width: 18px; height: 18px; }
    .featured-actions { display: flex; gap: 12px; }

    .btn-primary-lg { display: inline-flex; align-items: center; gap: 8px; background: white; color: #0a0a0a; border: none; padding: 12px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s ease; }
    .btn-primary-lg:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(0,0,0,0.25); }
    .btn-primary-lg svg { width: 14px; height: 14px; }
    .btn-secondary { background: var(--surface-base); color: var(--text-primary); border: 1px solid var(--border-default); padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .btn-secondary:hover { background: var(--surface-subtle); border-color: var(--border-strong); }

    /* Filters */
    .filters { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
    .filters-search { flex: 1; min-width: 280px; display: flex; align-items: center; gap: 10px; background: var(--surface-base); border: 1px solid var(--border-default); border-radius: 10px; padding: 9px 14px; transition: all 0.15s ease; }
    .filters-search:focus-within { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(227, 6, 19,0.1); }
    .filters-search svg { width: 16px; height: 16px; color: var(--text-tertiary); flex-shrink: 0; }
    .filters-search input { flex: 1; border: none; background: transparent; outline: none; font-size: 14px; font-family: inherit; color: var(--text-primary); }
    .search-clear { background: var(--surface-muted); border: none; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; color: var(--text-tertiary); font-size: 12px; }

    .filters-toolbar { display: flex; gap: 8px; align-items: center; }
    .filter-chip-icon { display: inline-flex; align-items: center; gap: 7px; background: var(--surface-base); border: 1px solid var(--border-default); padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s ease; color: var(--text-primary); }
    .filter-chip-icon:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
    .filter-chip-icon.active { background: var(--accent-primary); color: white; border-color: var(--accent-primary); }
    .filter-chip-icon svg { width: 13px; height: 13px; }
    .filter-badge { background: white; color: var(--accent-primary); border-radius: 20px; padding: 1px 7px; font-size: 11px; font-weight: 700; }
    .filter-chip-icon.active .filter-badge { background: rgba(255,255,255,0.3); color: white; }
    .sort-select { background: var(--surface-base); border: 1px solid var(--border-default); padding: 8px 12px; border-radius: 10px; font-size: 13px; font-family: inherit; color: var(--text-primary); cursor: pointer; outline: none; }

    /* Advanced filters */
    .adv-filters { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 20px; margin-bottom: 20px; display: grid; grid-template-columns: 2fr 1fr 1fr auto; gap: 20px; align-items: end; animation: slide-down 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    @media (max-width: 768px) { .adv-filters { grid-template-columns: 1fr; } }
    .af-group { display: flex; flex-direction: column; gap: 8px; }
    .af-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .af-range { width: 100%; accent-color: var(--accent-primary); }
    .af-date { background: var(--surface-base); border: 1px solid var(--border-default); padding: 8px 12px; border-radius: 8px; font-size: 13px; font-family: inherit; color: var(--text-primary); outline: none; }
    .cat-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .cat-pill { background: var(--surface-base); border: 1px solid var(--border-default); padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .cat-pill:hover { border-color: var(--border-strong); color: var(--text-primary); }
    .cat-pill.active { background: var(--text-primary); color: white; border-color: var(--text-primary); }
    .af-actions { display: flex; align-items: end; }
    .af-reset { background: transparent; border: none; color: var(--accent-primary); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; padding: 8px 0; }

    /* Section */
    .cat-head { margin-bottom: 24px; }
    .cat-h1 { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 6px; }
    .cat-sub { font-size: 14px; color: var(--text-secondary); margin: 0; }

    /* ━━━ Catalogue : hero + recherche ━━━ */
    .cat-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 20px; flex-wrap: wrap; }
    .cat-hero-txt { min-width: 240px; }
    .cat-search { display: flex; align-items: center; gap: 10px; background: var(--surface-base); border: 1px solid var(--border-default); border-radius: 12px; padding: 11px 16px; flex: 1; min-width: 280px; max-width: 460px; transition: all 0.15s ease; }
    .cat-search:focus-within { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(227, 6, 19,0.1); }
    .cat-search svg { width: 16px; height: 16px; color: var(--text-tertiary); flex-shrink: 0; }
    .cat-search input { flex: 1; border: none; background: transparent; outline: none; font-size: 14px; font-family: inherit; color: var(--text-primary); }
    .cat-search .search-clear { background: var(--surface-muted); border: none; width: 22px; height: 22px; border-radius: 50%; cursor: pointer; color: var(--text-tertiary); font-size: 12px; }

    /* ━━━ Onglets par type ━━━ */
    .type-tabs { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0; }
    .type-tabs button { display: inline-flex; align-items: center; gap: 8px; background: transparent; border: none; border-bottom: 2px solid transparent; padding: 10px 14px; margin-bottom: -1px; font-size: 14px; font-weight: 600; color: var(--text-secondary); cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .type-tabs button:hover { color: var(--text-primary); }
    .type-tabs button.on { color: var(--accent-primary, #e30613); border-bottom-color: var(--accent-primary, #e30613); }
    .type-tabs .tt-ico { width: 15px; height: 15px; flex-shrink: 0; }
    .type-tabs .tt-n { font-size: 11px; font-weight: 700; background: var(--surface-muted); color: var(--text-tertiary); padding: 1px 7px; border-radius: 20px; }
    .type-tabs button.on .tt-n { background: var(--accent-primary-soft, #fdeceb); color: var(--accent-primary, #e30613); }

    /* ━━━ Filtres secondaires ━━━ */
    .cat-filters { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .cf-select { background: var(--surface-base); border: 1px solid var(--border-default); padding: 8px 12px; border-radius: 9px; font-size: 13px; font-family: inherit; color: var(--text-primary); cursor: pointer; outline: none; }
    .cf-select:focus { border-color: var(--accent-primary); }
    .cf-reset { background: transparent; border: none; color: var(--accent-primary, #e30613); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .cf-spacer { flex: 1; }
    .cat-count { font-size: 13px; color: var(--text-tertiary); margin-bottom: 18px; }
    .cat-count strong { color: var(--text-primary); font-weight: 700; }

    /* ━━━ Planning ━━━ */
    .pl-toolbar { margin-bottom: 22px; }
    .pl-toolbar .segmented { display: inline-flex; background: var(--surface-muted); border-radius: 9px; padding: 3px; }
    .pl-toolbar .segmented button { background: transparent; border: none; padding: 7px 16px; font-size: 13px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: 7px; font-family: inherit; transition: all 0.15s ease; }
    .pl-toolbar .segmented button:hover { color: var(--text-primary); }
    .pl-toolbar .segmented button.active { background: var(--surface-base); color: var(--text-primary); box-shadow: var(--shadow-xs); }
    .pl-month { margin-bottom: 28px; }
    .pl-month-head { display: flex; align-items: baseline; gap: 10px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--border-subtle); }
    .pl-month-name { font-size: 17px; font-weight: 700; text-transform: capitalize; letter-spacing: -0.2px; }
    .pl-month-count { font-size: 12px; color: var(--text-tertiary); font-weight: 500; }
    .pl-table { display: flex; flex-direction: column; }
    .pl-row { display: flex; align-items: center; gap: 16px; padding: 14px 16px; border: 1px solid var(--border-subtle); border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: all 0.15s ease; background: var(--surface-base); }
    .pl-row:hover { border-color: var(--accent-primary); box-shadow: var(--shadow-sm); }
    .pl-date { width: 48px; flex-shrink: 0; text-align: center; }
    .pl-d { display: block; font-size: 20px; font-weight: 800; line-height: 1; letter-spacing: -0.5px; }
    .pl-m { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); margin-top: 3px; font-weight: 600; }
    .pl-info { flex: 1; min-width: 0; }
    .pl-title { font-size: 14px; font-weight: 600; margin-bottom: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pl-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); flex-wrap: wrap; }
    .pl-cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .pl-seats { font-size: 12px; color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
    .pl-cta { background: var(--accent-primary, #e30613); color: #fff; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; flex-shrink: 0; transition: background 0.15s ease; }
    .pl-cta:hover { background: var(--accent-primary-hover, #bd0410); }
    .pl-done { font-size: 12px; font-weight: 700; color: var(--accent-success, #0a8043); background: var(--accent-success-soft, #ecfdf5); padding: 6px 12px; border-radius: 8px; white-space: nowrap; flex-shrink: 0; }
    @media (max-width: 640px) { .pl-row { flex-wrap: wrap; } .pl-info { flex-basis: 60%; } }
    .section { margin-bottom: 48px; }
    .section-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 20px; }
    .section-title { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; margin: 0; }
    .section-meta { font-size: 13px; color: var(--text-tertiary); }

    /* Event grid */
    .grid-events { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .event-card { position: relative; background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); }
    .event-card:hover { transform: translateY(-3px); border-color: var(--border-default); box-shadow: var(--shadow-lg); }
    .ec-accent { position: absolute; top: 0; left: 0; right: 0; height: 4px; }
    .ec-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .ec-tag { font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--surface-muted); border: 1px solid var(--border-subtle); padding: 3px 9px; border-radius: 6px; }
    .ec-tag-cert { color: #b45309; background: #fffbeb; border-color: #fde68a; }
    .event-card-head { display: flex; align-items: center; gap: 8px; padding: 14px 18px 0; flex-wrap: wrap; }
    .ec-type { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; padding: 3px 9px; border-radius: 6px; background: var(--accent-primary-soft, #fdeceb); color: var(--accent-primary, #e30613); }
    .ec-type-formation { background: #eef2ff; color: #4338ca; }
    .ec-cat { font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--surface-muted); padding: 3px 9px; border-radius: 20px; }
    .event-reserved-badge { margin-left: auto; font-size: 11px; font-weight: 700; color: var(--accent-success, #0a8043); background: var(--accent-success-soft, #ecfdf5); padding: 3px 9px; border-radius: 20px; }
    .event-card-body { padding: 14px 18px 18px; }
    .event-card-title { font-size: 16px; font-weight: 600; margin: 0 0 8px; letter-spacing: -0.2px; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .event-card-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-tertiary); margin-bottom: 14px; flex-wrap: wrap; }
    .event-card-meta svg { width: 12px; height: 12px; }
    .event-card-meta span { display: inline-flex; align-items: center; gap: 4px; }
    .event-dot { opacity: 0.5; }
    .event-card-seats { margin-bottom: 14px; }
    .seats-track { height: 5px; background: var(--surface-muted); border-radius: 99px; overflow: hidden; margin-bottom: 5px; }
    .seats-fill { height: 100%; background: var(--accent-primary, #e30613); border-radius: 99px; transition: width 0.5s ease; }
    .seats-text { font-size: 11px; color: var(--text-tertiary); }
    .event-card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid var(--border-subtle); }
    .event-format { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    .event-cta { display: inline-flex; align-items: center; gap: 4px; background: var(--text-primary); color: white; border: none; padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .event-cta:hover { transform: scale(1.04); }
    .event-cta svg { width: 12px; height: 12px; transition: transform 0.15s ease; }
    .event-cta:hover svg { transform: translateX(2px); }

    /* Skeleton */
    .event-skel { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 16px; overflow: hidden; }
    .skel-img { height: 200px; background: linear-gradient(90deg, var(--surface-subtle) 0%, var(--surface-muted) 50%, var(--surface-subtle) 100%); background-size: 200% 100%; animation: shimmer 1.6s ease infinite; }
    .skel-line { height: 12px; margin: 18px; border-radius: 6px; background: linear-gradient(90deg, var(--surface-subtle) 0%, var(--surface-muted) 50%, var(--surface-subtle) 100%); background-size: 200% 100%; animation: shimmer 1.6s ease infinite; }
    .skel-line-1 { width: 70%; margin-bottom: 8px; }
    .skel-line-2 { width: 40%; height: 10px; margin-top: 0; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    /* Empty */
    .empty { text-align: center; padding: 80px 24px; }
    .empty-glyph { width: 64px; height: 64px; margin: 0 auto 18px; color: var(--text-quaternary); }
    .empty-glyph svg { width: 100%; height: 100%; }
    .empty-title { font-size: 18px; font-weight: 600; margin-bottom: 6px; }
    .empty-desc { font-size: 14px; color: var(--text-tertiary); margin-bottom: 20px; }

    /* Wallet & Tickets */
    .wallet-head, .fav-head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; flex-wrap: wrap; gap: 16px; }
    .wallet-h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.6px; margin: 0 0 6px; }
    .wallet-sub { font-size: 14px; color: var(--text-secondary); margin: 0; }
    .wallet-stats { display: flex; gap: 24px; }
    .wallet-stat { text-align: right; }
    .wallet-stat-v { font-size: 24px; font-weight: 700; line-height: 1; }
    .wallet-stat-l { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px; }

    /* ── Bandeaux de synthèse du wallet ── */
    .wallet-stat-cert .wallet-stat-v { color: #047857; }
    .wallet-alert { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 12px;
      font-size: 13.5px; margin-bottom: 16px; border: 1px solid transparent; }
    .wallet-alert svg { width: 18px; height: 18px; flex-shrink: 0; }
    .wallet-alert-ok { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .wallet-alert-info { background: #eef2ff; border-color: #c7d2fe; color: #3730a3; }

    /* ── Badges de statut (progression + certificat) ── */
    .badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600;
      padding: 3px 9px; border-radius: 20px; white-space: nowrap; letter-spacing: .1px; }
    .badge-neutral { background: var(--surface-muted); color: var(--text-secondary); }
    .badge-info { background: #eef2ff; color: #4338ca; }
    .badge-warn { background: #fffbeb; color: #b45309; }
    .badge-success { background: #ecfdf5; color: #047857; }
    .badge-danger { background: #fef2f2; color: #b91c1c; }

    /* ── Liste « Mes inscriptions » (remplace l'affichage billet) ── */
    .reg-list { display: flex; flex-direction: column; gap: 14px; }
    .reg-item { display: flex; flex-direction: column;
      background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px;
      overflow: hidden; transition: border-color .15s ease, box-shadow .15s ease; }
    .reg-item:hover { border-color: var(--border-default); box-shadow: var(--shadow-sm); }
    .reg-top { display: flex; align-items: center; gap: 18px; padding: 16px 20px; }
    .reg-cancelled { opacity: .6; }
    .reg-done { border-color: #a7f3d0; }
    .reg-date { width: 58px; flex-shrink: 0; text-align: center; padding: 8px 0; background: var(--accent-primary-soft); border-radius: 12px; }
    .reg-d { display: block; font-size: 22px; font-weight: 800; line-height: 1; color: var(--accent-primary); }
    .reg-mo { display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: var(--accent-primary); margin-top: 2px; }
    .reg-main { flex: 1; min-width: 0; }
    .reg-title-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .reg-title { font-size: 15px; font-weight: 600; margin: 0; color: var(--text-primary); }
    .reg-status { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; background: var(--surface-muted); color: var(--text-secondary); }
    .reg-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .reg-status.st-ok { background: #ecfdf5; color: #047857; }
    .reg-status.st-pending { background: #fffbeb; color: #b45309; }
    .reg-status.st-cancel { background: #fef2f2; color: #b91c1c; }
    .reg-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; margin-top: 6px; font-size: 12.5px; color: var(--text-tertiary); }
    .reg-meta svg { width: 13px; height: 13px; vertical-align: -2px; margin-right: 4px; }
    .reg-dot { opacity: .5; }
    .reg-ref { font-size: 11px; color: var(--text-quaternary); margin-top: 6px; font-family: 'SF Mono','Monaco',monospace; }
    .reg-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end; }
    .reg-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 13px; border-radius: 9px; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; text-decoration: none; border: 1px solid var(--border-default); background: var(--surface-base); color: var(--text-primary); transition: all .15s ease; white-space: nowrap; }
    .reg-btn svg { width: 14px; height: 14px; }
    .reg-btn:hover { background: var(--surface-subtle); border-color: var(--border-strong); }
    .reg-btn-primary { background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; }
    .reg-btn-primary:hover { background: var(--accent-primary-hover); border-color: var(--accent-primary-hover); color: #fff; }
    .reg-btn-ghost { border-color: transparent; background: transparent; color: var(--text-secondary); }
    .reg-btn-ghost:hover { background: var(--surface-muted); color: var(--text-primary); }
    .reg-btn-danger { color: #b91c1c; border-color: #fecaca; }
    .reg-btn-danger:hover { background: #fef2f2; border-color: #f87171; }

    /* ── Suivi de progression dans la session ── */
    .track { padding: 14px 20px 16px; border-top: 1px dashed var(--border-subtle); background: var(--surface-subtle); }
    .track-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px; }
    .track-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .7px; color: var(--text-tertiary); }
    .track-pct { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .track-bar { height: 6px; border-radius: 6px; background: var(--surface-muted); overflow: hidden; }
    .track-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg,#6366f1,#818cf8);
      transition: width .5s cubic-bezier(.16,1,.3,1); min-width: 2px; }
    .track-fill-done { background: linear-gradient(90deg,#059669,#34d399); }

    .track-steps { display: flex; list-style: none; margin: 14px 0 0; padding: 0; gap: 4px; }
    .track-step { flex: 1; min-width: 0; position: relative; display: flex; flex-direction: column;
      align-items: center; text-align: center; gap: 6px; }
    /* Trait de liaison entre deux jalons */
    .track-step:not(:first-child)::before { content: ''; position: absolute; top: 9px; right: 50%; left: -50%;
      height: 2px; background: var(--border-default); }
    .track-step.on:not(:first-child)::before { background: #34d399; }
    .track-dot { position: relative; z-index: 1; width: 20px; height: 20px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--surface-base); border: 2px solid var(--border-default); color: transparent; }
    .track-dot svg { width: 11px; height: 11px; }
    .track-step.on .track-dot { background: #059669; border-color: #059669; color: #fff; }
    .track-step.missed .track-dot { background: #fef2f2; border-color: #f87171; color: #b91c1c; }
    .track-step-label { font-size: 11.5px; color: var(--text-tertiary); line-height: 1.3; }
    .track-step.on .track-step-label { color: var(--text-primary); font-weight: 600; }
    .track-step-note { font-size: 10px; font-weight: 600; color: #b91c1c; }
    .track-end { margin-top: 12px; font-size: 12px; color: var(--text-tertiary); }

    /* ── Certificat de participation ── */
    .cert { display: flex; align-items: center; gap: 14px; padding: 14px 20px; border-top: 1px solid var(--border-subtle); }
    .cert[data-tone='success'] { background: #f0fdf4; }
    .cert[data-tone='info'] { background: #f5f7ff; }
    .cert[data-tone='warn'] { background: #fffdf5; }
    .cert-ico { width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: var(--surface-muted); color: var(--text-tertiary); }
    .cert-ico svg { width: 20px; height: 20px; }
    .cert[data-tone='success'] .cert-ico { background: #d1fae5; color: #047857; }
    .cert[data-tone='info'] .cert-ico { background: #e0e7ff; color: #4338ca; }
    .cert[data-tone='warn'] .cert-ico { background: #fef3c7; color: #b45309; }
    .cert-body { flex: 1; min-width: 0; }
    .cert-head { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
    .cert-title { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .cert-msg { margin: 5px 0 0; font-size: 12.5px; color: var(--text-secondary); line-height: 1.5; }
    .cert-sent { margin-top: 4px; font-size: 11px; color: var(--text-tertiary); }
    .cert-btn { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; padding: 9px 15px;
      border-radius: 9px; border: 1px solid #059669; background: #059669; color: #fff;
      font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer; transition: all .15s ease; }
    .cert-btn svg { width: 15px; height: 15px; }
    .cert-btn:hover:not(:disabled) { background: #047857; border-color: #047857; }
    .cert-btn:disabled { opacity: .6; cursor: default; }

    @media (max-width: 720px) {
      .reg-top { flex-wrap: wrap; }
      .reg-actions { width: 100%; justify-content: flex-start; }
      .track-step-label { font-size: 10px; }
      .cert { flex-wrap: wrap; }
      .cert-btn { width: 100%; justify-content: center; }
    }

    .tickets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px; }
    .ticket { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; transition: all 0.25s ease; }
    .ticket:hover { border-color: var(--border-default); box-shadow: var(--shadow-md); }
    .ticket-cancelled { opacity: 0.6; }
    .ticket-banner { position: relative; height: 120px; background-size: cover; background-position: center; background-color: var(--surface-muted); }
    .ticket-banner-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.5)); }
    .ticket-banner-content { position: absolute; inset: 0; padding: 14px; z-index: 2; }
    .ticket-status { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; background: rgba(255,255,255,0.95); backdrop-filter: blur(8px); font-size: 11px; font-weight: 600; }
    .ts-dot { width: 6px; height: 6px; border-radius: 50%; }
    .ts-active .ts-dot { background: var(--accent-success); }
    .ts-active { color: var(--accent-success); }
    .ts-cancelled .ts-dot { background: var(--accent-danger); }
    .ts-cancelled { color: var(--accent-danger); }
    .ticket-body { padding: 18px 20px 20px; }
    .ticket-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; }
    .ticket-info { display: flex; flex-direction: column; gap: 8px; }
    .ticket-info-row { display: flex; justify-content: space-between; align-items: center; }
    .ticket-info-l { font-size: 12px; color: var(--text-tertiary); }
    .ticket-info-v { font-size: 13px; color: var(--text-primary); font-weight: 500; }
    .ticket-ref { font-family: monospace; background: var(--surface-muted); padding: 2px 8px; border-radius: 4px; }
    .ticket-divider { position: relative; height: 1px; margin: 18px -20px; }
    .divider-notch { position: absolute; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; background: var(--surface-canvas); border-radius: 50%; border: 1px solid var(--border-subtle); }
    .divider-notch-l { left: -7px; } .divider-notch-r { right: -7px; }
    .divider-dash { height: 1px; background-image: linear-gradient(90deg, var(--border-default) 50%, transparent 50%); background-size: 6px 1px; background-repeat: repeat-x; }
    .ticket-footer { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
    .ticket-qr-real {
      width: 72px; height: 72px;
      padding: 6px; background: white;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .ticket-qr-real img { width: 100%; height: 100%; display: block; }
    .ticket-cancel { background: transparent; border: 1px solid var(--border-default); color: var(--text-secondary); padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .ticket-cancel:hover { background: var(--accent-danger-soft); color: var(--accent-danger); border-color: transparent; }
    .ticket-cancelled-label { font-size: 12px; color: var(--text-tertiary); font-style: italic; }

    /* ━━━━━━━━━━━━━━━━━━━━ MODAL EVENT DETAILS ━━━━━━━━━━━━━━━━━━━━ */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(6px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; animation: modal-fade 0.2s ease; overflow-y: auto; }
    @keyframes modal-fade { from { opacity: 0; } to { opacity: 1; } }

    .modal-event { background: var(--surface-base); border-radius: 24px; max-width: 1100px; width: 100%; max-height: 90vh; overflow-y: auto; position: relative; animation: modal-slide 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 32px 80px rgba(0,0,0,0.3); }
    @keyframes modal-slide { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .modal-close { position: absolute; top: 20px; right: 20px; z-index: 10; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); border: none; cursor: pointer; color: white; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .modal-close:hover { background: rgba(0,0,0,0.7); transform: rotate(90deg); }
    .modal-close svg { width: 16px; height: 16px; }

    .modal-banner { position: relative; height: 320px; background-size: cover; background-position: center; }
    .modal-banner-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%); }
    .modal-fav { position: absolute; top: 20px; left: 20px; z-index: 5; width: 44px; height: 44px; border-radius: 50%; background: rgba(0,0,0,0.5); backdrop-filter: blur(10px); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .modal-fav:hover { background: rgba(0,0,0,0.7); transform: scale(1.1); }
    .modal-fav svg { width: 22px; height: 22px; }
    .modal-banner-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px; color: white; z-index: 4; }
    .modal-cat { display: inline-block; background: rgba(255,255,255,0.2); backdrop-filter: blur(8px); color: white; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px; }
    .modal-title { font-size: 36px; font-weight: 700; letter-spacing: -1px; margin: 0 0 14px; line-height: 1.1; }
    .modal-banner-meta { display: flex; gap: 20px; flex-wrap: wrap; }
    .modal-banner-meta span { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; opacity: 0.9; }
    .modal-banner-meta svg { width: 16px; height: 16px; }

    .modal-body { padding: 36px 40px; }
    .modal-grid { display: grid; grid-template-columns: 1fr 360px; gap: 36px; }
    @media (max-width: 968px) { .modal-grid { grid-template-columns: 1fr; } }

    .modal-section-title { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; margin: 0 0 12px; }
    .modal-section-title:not(:first-child) { margin-top: 32px; }
    .modal-desc { font-size: 15px; line-height: 1.7; color: var(--text-secondary); margin: 0; }

    .modal-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 600px) { .modal-info-grid { grid-template-columns: 1fr; } }
    .sess-spec { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; margin-top: 14px; padding: 16px; background: var(--surface-subtle); border-radius: 12px; }
    @media (max-width: 600px) { .sess-spec { grid-template-columns: 1fr; } }
    .ss-item { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--text-primary); }
    .ss-item strong { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary); }
    .ss-full { grid-column: 1 / -1; }
    .modal-info-card { display: flex; align-items: center; gap: 12px; padding: 14px; background: var(--surface-subtle); border-radius: 12px; }
    .mi-ico { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .mi-ico svg { width: 20px; height: 20px; }
    .mi-label { font-size: 11px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; margin-bottom: 2px; }
    .mi-value { font-size: 14px; font-weight: 600; color: var(--text-primary); }

    .modal-seats { margin-top: 24px; padding: 18px; background: var(--surface-subtle); border-radius: 12px; }
    .ms-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .ms-label { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
    .ms-pct { font-size: 16px; font-weight: 700; color: var(--accent-primary); }
    .ms-bar { height: 8px; background: var(--surface-muted); border-radius: 99px; overflow: hidden; }
    .ms-fill { height: 100%; background: linear-gradient(90deg, #10b981, #f59e0b, #ef4444); border-radius: 99px; transition: width 0.6s ease; }

    /* ━━━ Countdown + ambiance ━━━ */
    .cd-ambiance { margin-bottom: 20px; }
    .cd-box {
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border-radius: 14px; padding: 16px 20px;
      margin-bottom: 12px;
    }
    .cd-unit { display: flex; flex-direction: column; align-items: center; min-width: 48px; }
    .cd-num {
      font-size: 28px; font-weight: 800; color: white;
      font-variant-numeric: tabular-nums; line-height: 1;
      animation: cd-pop 1s ease;
    }
    @keyframes cd-pop { 0% { transform: scale(1.15); } 100% { transform: scale(1); } }
    .cd-lbl { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; font-weight: 600; }
    .cd-sep { font-size: 24px; font-weight: 700; color: rgba(255,255,255,0.3); align-self: flex-start; margin-top: 2px; }
    .cd-past {
      display: flex; align-items: center; gap: 8px;
      background: var(--surface-muted); border-radius: 12px; padding: 14px 18px;
      font-size: 14px; color: var(--text-secondary); font-weight: 600; margin-bottom: 20px;
    }
    .cd-past svg { width: 16px; height: 16px; }
    .cd-soft { display: inline-flex; align-items: center; gap: 8px; background: var(--surface-muted); border-radius: 10px; padding: 8px 14px; font-size: 13px; color: var(--text-secondary); font-weight: 600; margin-bottom: 20px; }
    .cd-soft svg { width: 15px; height: 15px; }

    /* ━━━ Bloc accès visio ━━━ */
    .visio-block { display: flex; align-items: center; gap: 14px; background: var(--accent-primary-soft, #fdeceb); border: 1px solid rgba(227, 6, 19,0.18); border-radius: 14px; padding: 16px 18px; margin-bottom: 22px; }
    .visio-ico { width: 40px; height: 40px; flex-shrink: 0; border-radius: 10px; background: var(--accent-primary, #e30613); color: #fff; display: flex; align-items: center; justify-content: center; }
    .visio-ico svg { width: 20px; height: 20px; }
    .visio-info { flex: 1; }
    .visio-label { font-size: 11px; color: var(--accent-primary, #e30613); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 700; margin-bottom: 3px; }
    .visio-link { font-size: 15px; font-weight: 700; color: var(--accent-primary, #e30613); text-decoration: none; }
    .visio-link:hover { text-decoration: underline; }
    .visio-muted { font-size: 13px; color: var(--text-secondary); font-weight: 500; }

    /* ━━━ Modal map ━━━ */
    .modal-map-wrap { margin-bottom: 22px; border-radius: 14px; overflow: hidden; border: 1px solid var(--border-default); }
    .modal-map { width: 100%; height: 220px; background: #0c0c14; }
    .modal-map-addr { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--surface-subtle); font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .modal-map-addr svg { width: 15px; height: 15px; color: var(--accent-primary); }

    /* Reviews */
    .reviews-rating-badge {
      display: inline-flex; align-items: center; gap: 4px;
      background: linear-gradient(135deg,#fef3c7,#fde68a); color: #92400e;
      padding: 4px 12px; border-radius: 20px;
      font-size: 13px; font-weight: 700; margin-left: 10px;
    }
    .rr-sub { font-weight: 500; opacity: 0.7; }

    .rate-box { background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 16px 18px; margin-bottom: 18px; }
    .rate-title { font-size: 13px; font-weight: 600; margin-bottom: 10px; }
    .star-input { display: flex; gap: 4px; margin-bottom: 10px; }
    .star-btn { background: transparent; border: none; font-size: 28px; cursor: pointer; color: #d4d4d8; transition: all 0.15s ease; padding: 0; }
    .star-btn:hover { transform: scale(1.2); }
    .star-btn.filled { color: #f59e0b; }
    .rate-textarea { width: 100%; min-height: 70px; background: white; border: 1px solid var(--border-default); border-radius: 8px; padding: 8px 12px; font-size: 13px; font-family: inherit; color: var(--text-primary); outline: none; resize: vertical; margin-bottom: 10px; }
    .rate-textarea:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(227, 6, 19,0.1); }
    .rate-submit { background: var(--accent-primary); color: white; border: none; padding: 9px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .rate-submit:hover:not(:disabled) { background: var(--accent-primary-hover); }
    .rate-submit:disabled { opacity: 0.5; cursor: not-allowed; }

    .rate-info { display: flex; align-items: center; gap: 8px; background: var(--surface-subtle); border: 1px dashed var(--border-default); border-radius: 10px; padding: 12px 14px; font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
    .rate-info svg { width: 16px; height: 16px; flex-shrink: 0; color: var(--text-tertiary); }
    .rate-info-success { background: #ecfdf5; border-color: #d1fae5; color: #047857; }
    .rate-info-success svg { color: #10b981; }

    .reviews-list { display: flex; flex-direction: column; gap: 14px; }
    .review-item { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px 16px; }
    .review-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .review-ava { width: 32px; height: 32px; border-radius: 8px; background: linear-gradient(135deg,#e30613,#ff3341); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .review-user { font-size: 12px; font-weight: 600; font-family: monospace; }
    .review-date { font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
    .review-stars { margin-left: auto; display: flex; gap: 2px; color: #d4d4d8; font-size: 14px; }
    .review-stars span.filled { color: #f59e0b; }
    .review-comment { font-size: 13px; line-height: 1.6; color: var(--text-secondary); margin: 0; }
    .reviews-empty { text-align: center; color: var(--text-tertiary); font-size: 13px; padding: 20px 0; font-style: italic; }

    /* Side card */
    .modal-side { display: flex; flex-direction: column; gap: 16px; }
    .modal-price-card { background: var(--surface-base); border: 2px solid var(--border-subtle); border-radius: 16px; padding: 24px; position: sticky; top: 20px; }
    .mpc-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .mpc-type { font-size: 13px; font-weight: 700; color: #fff; background: var(--accent-primary, #e30613); padding: 3px 10px; border-radius: 20px; }
    .mpc-mode { font-size: 13px; font-weight: 600; color: var(--text-secondary); background: var(--surface-muted); padding: 3px 10px; border-radius: 20px; }
    .mpc-avail { font-size: 14px; color: var(--text-secondary); margin-bottom: 18px; }
    .mpc-avail strong { font-size: 22px; font-weight: 800; letter-spacing: -0.6px; color: var(--text-primary); }
    .mpc-divider { height: 1px; background: var(--border-subtle); margin-bottom: 18px; }
    .mpc-cta { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover)); color: white; border: none; padding: 14px 20px; border-radius: 12px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.2s ease; margin-bottom: 10px; box-shadow: 0 8px 24px rgba(227, 6, 19,0.3); }
    .mpc-cta svg { width: 16px; height: 16px; }
    .mpc-cta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(227, 6, 19,0.4); }
    .mpc-cta:disabled { cursor: default; opacity: 0.85; }
    .mpc-cta-done { background: linear-gradient(135deg, #10b981, #059669); box-shadow: 0 8px 24px rgba(16,185,129,0.3); }
    .mpc-cta-pending { background: linear-gradient(135deg, #f59e0b, #d97706); box-shadow: 0 8px 24px rgba(217,119,6,0.28); }
    .mpc-secondary { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--surface-base); color: var(--text-primary); border: 1px solid var(--border-default); padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; margin-bottom: 8px; }
    .mpc-secondary:hover { background: var(--surface-subtle); border-color: var(--accent-danger); color: var(--accent-danger); }
    .mpc-secondary svg { width: 14px; height: 14px; }
    .mpc-share { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; background: var(--surface-subtle); color: var(--text-secondary); border: none; padding: 11px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .mpc-share:hover { background: var(--surface-muted); color: var(--text-primary); }
    .mpc-share svg { width: 14px; height: 14px; }
    .mpc-footer { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--text-tertiary); }
    .mpc-footer svg { width: 14px; height: 14px; flex-shrink: 0; }

    .modal-share-tags { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 20px; }
    .mst-title { font-size: 13px; font-weight: 700; margin: 0 0 12px; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag-chip { padding: 4px 12px; background: var(--surface-subtle); color: var(--text-secondary); border-radius: 20px; font-size: 12px; font-weight: 500; }

    /* ━━━━━━━━━━━━━━━━━━━ MAP VIEW ━━━━━━━━━━━━━━━━━━━ */
    .view-toggle { display: inline-flex; background: var(--surface-muted); border-radius: 10px; padding: 3px; gap: 2px; }
    .view-toggle button {
      display: inline-flex; align-items: center; gap: 6px;
      background: transparent; border: none; padding: 7px 13px;
      font-size: 13px; font-weight: 600; color: var(--text-secondary);
      cursor: pointer; border-radius: 8px; font-family: inherit;
      transition: all 0.15s ease;
    }
    .view-toggle button svg { width: 14px; height: 14px; }
    .view-toggle button.active { background: var(--surface-base); color: var(--text-primary); box-shadow: var(--shadow-xs); }

    .map-section { position: relative; animation: fade-up 0.4s ease; }
    @keyframes fade-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .events-map {
      width: 100%; height: 560px;
      border-radius: 18px; overflow: hidden;
      border: 1px solid var(--border-default);
      box-shadow: var(--shadow-lg);
      background: #0c0c14;
    }
    .map-hint {
      display: inline-flex; align-items: center; gap: 8px;
      margin-top: 14px; padding: 8px 14px;
      background: var(--surface-base); border: 1px solid var(--border-subtle);
      border-radius: 10px; font-size: 12px; color: var(--text-secondary);
    }
    .map-hint svg { width: 14px; height: 14px; color: var(--accent-primary); }

    /* ━━━━━━━━━━━━━━━━━━━ LUXURY TICKET ━━━━━━━━━━━━━━━━━━━ */
    .tickets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 28px; }

    .lux-ticket {
      position: relative;
      display: flex; flex-direction: column;
      background:
        radial-gradient(circle at 20% 0%, rgba(227, 6, 19,0.14), transparent 50%),
        radial-gradient(circle at 80% 100%, rgba(196,29,20,0.12), transparent 50%),
        linear-gradient(160deg, #16161f 0%, #0d0d14 100%);
      border-radius: 22px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow:
        0 24px 60px rgba(0,0,0,0.5),
        0 0 0 1px rgba(255,255,255,0.04),
        inset 0 1px 0 rgba(255,255,255,0.06);
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .lux-ticket:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 36px 80px rgba(227, 6, 19,0.25), 0 0 0 1px rgba(255,255,255,0.08); }
    .lux-cancelled { opacity: 0.55; filter: grayscale(0.5); }

    /* Reflet animé */
    .lux-shine {
      position: absolute; top: 0; left: -60%;
      width: 50%; height: 100%;
      background: linear-gradient(105deg, transparent, rgba(255,255,255,0.08), transparent);
      transform: skewX(-20deg);
      pointer-events: none;
      animation: lux-shine-move 6s ease-in-out infinite;
    }
    @keyframes lux-shine-move {
      0%, 100% { left: -60%; }
      50% { left: 130%; }
    }

    .lux-main { padding: 26px 28px 20px; position: relative; z-index: 1; }
    .lux-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    .lux-brand { display: flex; align-items: center; gap: 9px; }
    .lux-logo {
      width: 30px; height: 30px; border-radius: 9px;
      background: linear-gradient(135deg, #e30613, #bd0410);
      display: flex; align-items: center; justify-content: center;
      color: white; box-shadow: 0 6px 16px rgba(227, 6, 19,0.4);
    }
    .lux-logo svg { width: 17px; height: 17px; }
    .lux-brand span { font-size: 14px; font-weight: 800; letter-spacing: 2px; color: #fff; }

    .lux-status {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
      backdrop-filter: blur(8px);
    }
    .lux-st-dot { width: 6px; height: 6px; border-radius: 50%; }
    .lux-st-active { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
    .lux-st-active .lux-st-dot { background: #34d399; box-shadow: 0 0 8px #34d399; animation: lux-pulse 1.6s ease infinite; }
    @keyframes lux-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
    .lux-st-cancel { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
    .lux-st-cancel .lux-st-dot { background: #f87171; }

    .lux-event-name {
      font-size: 24px; font-weight: 800; line-height: 1.2;
      letter-spacing: -0.5px; margin-bottom: 6px;
      color: #fff;
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }
    .lux-event-sub {
      font-size: 12px; color: rgba(255,255,255,0.45);
      text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;
      margin-bottom: 24px;
    }

    .lux-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 20px; }
    .lux-field-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; }
    .lux-field-value { font-size: 15px; font-weight: 700; color: #fff; }

    /* Perforation */
    .lux-perf { position: relative; height: 28px; display: flex; align-items: center; }
    .lux-notch {
      position: absolute; width: 28px; height: 28px;
      background: var(--surface-canvas, #fafafa);
      border-radius: 50%;
    }
    .lux-notch-l { left: -14px; }
    .lux-notch-r { right: -14px; }
    .lux-perf-line {
      flex: 1; height: 2px; margin: 0 18px;
      background-image: radial-gradient(circle, rgba(255,255,255,0.3) 1.2px, transparent 1.2px);
      background-size: 12px 2px; background-repeat: repeat-x;
    }

    /* Stub QR */
    .lux-stub {
      display: flex; align-items: center; gap: 18px;
      padding: 22px 28px 26px;
      position: relative; z-index: 1;
    }
    .lux-qr-wrap {
      width: 92px; height: 92px; flex-shrink: 0;
      padding: 8px; border-radius: 14px;
      background: white;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35), 0 0 0 4px rgba(255,255,255,0.08);
    }
    .lux-qr-img { width: 100%; height: 100%; display: block; border-radius: 6px; }
    .lux-qr-loading { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .lux-spinner {
      width: 24px; height: 24px; border: 2.5px solid #e5e7eb; border-top-color: #e30613;
      border-radius: 50%; animation: lux-spin 0.8s linear infinite;
    }
    @keyframes lux-spin { to { transform: rotate(360deg); } }

    .lux-ref { flex: 1; }
    .lux-ref-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; }
    .lux-ref-value { font-family: 'SF Mono', Monaco, monospace; font-size: 17px; font-weight: 700; color: #fff; letter-spacing: 1px; }
    .lux-view-link {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 10px;
      font-size: 12px; font-weight: 600;
      color: #a5b4fc; text-decoration: none;
      padding: 6px 12px; border-radius: 8px;
      background: rgba(227, 6, 19,0.12);
      border: 1px solid rgba(227, 6, 19,0.25);
      transition: all 0.2s ease;
    }
    .lux-view-link:hover { background: rgba(227, 6, 19,0.25); color: #c7d2fe; transform: translateY(-1px); }
    .lux-view-link svg { width: 13px; height: 13px; }

    .lux-cancel {
      background: rgba(239,68,68,0.12); color: #f87171;
      border: 1px solid rgba(239,68,68,0.25);
      padding: 9px 16px; border-radius: 10px;
      font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
      transition: all 0.2s ease;
    }
    .lux-cancel:hover { background: #ef4444; color: white; border-color: transparent; }

    /* Toast */
    .toast { position: fixed; bottom: 24px; right: 24px; display: flex; align-items: center; gap: 10px; background: #1a1a1a; color: white; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; box-shadow: 0 12px 32px rgba(0,0,0,0.2); z-index: 9999; animation: toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
    @keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .toast-icon { width: 16px; height: 16px; flex-shrink: 0; }
    .toast-icon svg { width: 100%; height: 100%; }
    .toast-success .toast-icon { color: #4ade80; }
    .toast-error .toast-icon { color: #f87171; }
  `]
})
export class UserComponent implements OnInit {
  private apiService = inject(ApiService);
  private keycloak = inject(KeycloakService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private cd = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private geo = inject(GeoService);
  private notifs = inject(NotifsService);

  viewMode: 'list' | 'map' = 'list';
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];

  countdown = { days: 0, hours: 0, mins: 0, secs: 0, past: false };
  private cdTimer: any = null;

  activeTab: 'discover' | 'planning' | 'wallet' = 'discover';
  planningMode: '' | 'presentiel' | 'enligne' = '';
  events: any[] = [];
  filteredEvents: any[] = [];
  myRegistrations: any[] = [];
  selectedEvent: any = null;
  registering: string | null = null;
  reservedSet = new Set<string>();   // inscriptions CONFIRMED
  pendingSet = new Set<string>();    // demandes PENDING (en attente de validation admin)
  reviews: any[] = [];
  loadingReviews = false;
  avgRating = 0;
  hasReviewed = false;
  newRating = 0;
  newComment = '';
  submittingFeedback = false;
  searchText = '';
  activeCategory = '';
  typeFilter: '' | 'FORMATION' | 'WORKSHOP' | 'CONFERENCE' = '';
  levelFilter = '';
  modeFilter = '';
  dateFrom = '';
  sortBy: 'date-asc' | 'date-desc' | 'seats-desc' = 'date-asc';
  filtersOpen = false;
  loadingEvents = false;
  userId = '';
  toast: { message: string; type: 'success' | 'error' } | null = null;
  categories = CATEGORIES;

  /** Certificat en cours de téléchargement (id d'inscription). */
  certBusy: string | null = null;

  get featuredEvent(): any { return this.filteredEvents[0] || null; }
  get otherEvents(): any[] { return this.filteredEvents.slice(1); }

  /** Sessions confirmées pas encore terminées. */
  get activeTickets(): number {
    return this.myRegistrations.filter(r => r.status === 'CONFIRMED' && r.progressStatus !== 'COMPLETED').length;
  }
  get completedCount(): number {
    return this.myRegistrations.filter(r => r.progressStatus === 'COMPLETED').length;
  }
  /** Certificats délivrés, téléchargeables immédiatement. */
  get certificatesReady(): number {
    return this.myRegistrations.filter(r => r.certificateDownloadable).length;
  }
  /** Certificats en préparation ou en attente de la décision de l'administrateur. */
  get certificatesPreparing(): number {
    return this.myRegistrations.filter(
      r => r.certificateStatus === 'IN_PREPARATION' || r.certificateStatus === 'PENDING_APPROVAL').length;
  }

  // ─── Libellés de suivi (vocabulaire partagé avec l'espace administrateur) ───
  progressLabelOf(reg: any): string { return progressLabel(reg?.progressStatus); }
  progressToneOf(reg: any): string { return progressTone(reg?.progressStatus); }
  certificateLabelOf(reg: any): string { return certificateLabel(reg?.certificateStatus); }
  certificateToneOf(reg: any): string { return certificateTone(reg?.certificateStatus); }
  certificateMessageOf(reg: any): string { return certificateMessage(reg?.certificateStatus); }

  /**
   * Intitulé et date de la session d'une inscription.
   * On lit d'abord les champs dénormalisés portés par l'inscription : une session
   * terminée peut avoir été retirée du catalogue, son suivi doit rester lisible.
   */
  regTitle(reg: any): string {
    return reg?.eventTitle || this.getEventTitle(reg?.eventId);
  }
  regDate(reg: any): any {
    return reg?.eventDateStr || this.getEvent(reg?.eventId)?.eventDate || null;
  }

  /** Nb de sessions d'un type (compteurs des onglets du catalogue). */
  countType(t: string): number {
    return this.events.filter(e => (e.type || '').toUpperCase() === t).length;
  }
  setTypeFilter(t: '' | 'FORMATION' | 'WORKSHOP' | 'CONFERENCE') { this.typeFilter = t; this.filterEvents(); }

  get activeFiltersCount(): number {
    let n = 0;
    if (this.activeCategory) n++;
    if (this.levelFilter) n++;
    if (this.modeFilter) n++;
    if (this.dateFrom) n++;
    return n;
  }

  @HostListener('window:keydown.escape')
  onEsc() { if (this.selectedEvent) this.closeDetails(); }

  ngOnInit() {
    // Charge le profil et les events une seule fois
    this.keycloak.loadUserProfile().then(profile => {
      this.zone.run(() => {
        this.userId = profile.id || '';
        this.loadEvents();
        // Si on est déjà sur l'onglet wallet, charge les regs
        if (this.activeTab === 'wallet') this.loadMyRegistrations();
        this.cd.markForCheck();
      });
    }).catch(() => {
      this.zone.run(() => this.loadEvents());
    });

    // Réagit AUX CHANGEMENTS D'URL — chaque navigation /user, /user/wallet
    // fire cette subscription, MÊME si le composant est réutilisé.
    this.route.url.subscribe(segs => {
      const last = segs[segs.length - 1]?.path;
      const newTab = last === 'wallet' ? 'wallet' : last === 'planning' ? 'planning' : 'discover';
      if (newTab !== this.activeTab) {
        this.activeTab = newTab;
      }
      // Toujours recharger les données du tab cible
      if (newTab === 'wallet' && this.userId) this.loadMyRegistrations();
      this.cd.markForCheck();
    });
  }

  loadEvents() {
    this.loadingEvents = true;
    // Le participant ne voit QUE les événements approuvés par l'admin (modération)
    this.apiService.getPublishedEvents().subscribe({
      next: d => {
        this.zone.run(() => {
          this.events = d;
          this.filterEvents();
          this.loadingEvents = false;
          this.cd.detectChanges();
        });
        // Sync reserved set
        if (this.userId) this.loadMyRegistrations();
      },
      error: () => { this.zone.run(() => { this.loadingEvents = false; this.cd.detectChanges(); }); }
    });
  }

  setCategory(cat: string) { this.activeCategory = cat; this.filterEvents(); }

  filterEvents() {
    const q = this.searchText.toLowerCase();
    const fromTs = this.dateFrom ? new Date(this.dateFrom).getTime() : 0;
    let list = this.events.filter(e => {
      const matchSearch = !q || `${e.title || ''} ${e.category || ''} ${e.location || ''} ${e.description || ''} ${e.certification || ''}`.toLowerCase().includes(q);
      const matchCat = !this.activeCategory || e.category === this.activeCategory;
      const matchType = !this.typeFilter || (e.type || '').toUpperCase() === this.typeFilter;
      const matchLevel = !this.levelFilter || e.level === this.levelFilter;
      const matchMode = !this.modeFilter || (e.mode || 'PRESENTIEL').toUpperCase() === this.modeFilter;
      const matchDate = !fromTs || new Date(e.eventDate || 0).getTime() >= fromTs;
      return matchSearch && matchCat && matchType && matchLevel && matchMode && matchDate;
    });

    list.sort((a, b) => {
      switch (this.sortBy) {
        case 'date-asc': return new Date(a.eventDate || 0).getTime() - new Date(b.eventDate || 0).getTime();
        case 'date-desc': return new Date(b.eventDate || 0).getTime() - new Date(a.eventDate || 0).getTime();
        case 'seats-desc': return (b.availableSeats ?? b.totalSeats ?? 0) - (a.availableSeats ?? a.totalSeats ?? 0);
        default: return 0;
      }
    });

    this.filteredEvents = list;
  }

  resetFilters() {
    this.searchText = ''; this.activeCategory = '';
    this.typeFilter = ''; this.levelFilter = ''; this.modeFilter = '';
    this.dateFrom = ''; this.sortBy = 'date-asc';
    this.filterEvents();
    if (this.viewMode === 'map') this.refreshMarkers();
  }

  setView(mode: 'list' | 'map') {
    this.viewMode = mode;
    if (mode === 'map') {
      // Laisse le DOM se rendre avant d'initialiser Leaflet
      setTimeout(() => this.initMap(), 60);
    }
  }

  private initMap() {
    const el = document.getElementById('events-map');
    if (!el) return;

    if (!this.map) {
      const c = this.geo.defaultCenter();
      this.map = L.map('events-map', { zoomControl: true, attributionControl: false }).setView([c.lat, c.lng], 6);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19, subdomains: 'abcd'
      }).addTo(this.map);
    } else {
      this.map.invalidateSize();
    }
    this.refreshMarkers();
  }

  private refreshMarkers() {
    if (!this.map) return;
    this.markers.forEach(m => this.map!.removeLayer(m));
    this.markers = [];

    const catColors: Record<string, string> = {
      'Cloud': '#3b82f6', 'DevOps': '#e30613', 'Cybersécurité': '#8b5cf6',
      'Certification': '#c9a14a', 'Workshop': '#10b981', 'Conférence': '#06b6d4', 'Autre': '#6b7280'
    };
    const bounds: L.LatLngTuple[] = [];

    this.filteredEvents.forEach(ev => {
      const pos = this.geo.resolveEvent(ev);
      const color = catColors[ev.category] || '#e30613';
      const typeBadge = this.typeLabel(ev);

      const icon = L.divIcon({
        className: 'evt-marker',
        html: `<div class="evt-pin" style="--pin:${color}">
                 <div class="evt-pin-inner">${this.markerEmoji(ev.category)}</div>
               </div>`,
        iconSize: [40, 48], iconAnchor: [20, 48], popupAnchor: [0, -44]
      });

      const marker = L.marker([pos.lat, pos.lng], { icon });
      const dateStr = ev.eventDate ? new Date(ev.eventDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '';
      marker.bindPopup(`
        <div class="evt-popup">
          <div class="evt-popup-img" style="background:${this.catGradient(ev.category)}"></div>
          <div class="evt-popup-body">
            <div class="evt-popup-cat" style="color:${color}">${ev.category || 'Événement'}</div>
            <div class="evt-popup-title">${this.esc(ev.title)}</div>
            <div class="evt-popup-meta">📍 ${this.esc(ev.location || 'N/A')} · 📅 ${dateStr}</div>
            <div class="evt-popup-foot">
              <span class="evt-popup-price">${typeBadge}</span>
              <button class="evt-popup-btn" onclick="window.dispatchEvent(new CustomEvent('open-event', {detail: '${ev.id}'}))">Voir</button>
            </div>
          </div>
        </div>
      `, { maxWidth: 260, className: 'evt-popup-wrap' });

      marker.addTo(this.map!);
      this.markers.push(marker);
      bounds.push([pos.lat, pos.lng]);
    });

    if (bounds.length > 0) {
      this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11 });
    }
  }

  private markerEmoji(cat: string): string {
    const m: Record<string, string> = { 'Cloud': '☁️', 'DevOps': '⚙️', 'Cybersécurité': '🔒', 'Certification': '🎓', 'Workshop': '🛠️', 'Conférence': '🎤' };
    return m[cat] || '📍';
  }

  private esc(s: string): string {
    return (s || '').replace(/[<>&"']/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' } as any)[c]);
  }

  @HostListener('window:open-event', ['$event'])
  onOpenEventFromMap(e: any) {
    const id = e.detail;
    const ev = this.events.find(x => x.id === id);
    if (ev) this.zone.run(() => this.openDetails(ev));
  }

  private detailMap: L.Map | null = null;

  /**
   * Ouvre la fiche de la session depuis « Mes inscriptions ».
   * Le catalogue ne contient que les sessions publiées : une session retirée
   * depuis l'inscription n'y figure plus, on le dit plutôt que d'ouvrir une
   * fiche vide.
   */
  openRegDetails(reg: any): void {
    const ev = this.getEvent(reg?.eventId);
    if (!ev) { this.showToast("Cette session n'est plus au catalogue.", 'error'); return; }
    this.openDetails(ev);
  }

  openDetails(ev: any) {
    this.selectedEvent = ev;
    document.body.style.overflow = 'hidden';
    this.loadReviews(ev.id);
    this.startCountdown(ev.eventDate);
    // Init carte localisation après rendu du DOM
    setTimeout(() => this.initDetailMap(ev), 120);
  }

  private initDetailMap(ev: any) {
    const el = document.getElementById('modal-map');
    if (!el) return;
    // Reset map précédente
    if (this.detailMap) { this.detailMap.remove(); this.detailMap = null; }

    const pos = this.geo.resolveEvent(ev);
    this.detailMap = L.map('modal-map', { zoomControl: true, attributionControl: false, scrollWheelZoom: false })
      .setView([pos.lat, pos.lng], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(this.detailMap);

    const color = categoryColor(ev.category);
    const icon = L.divIcon({
      className: 'evt-marker',
      html: `<div class="evt-pin" style="--pin:${color}"><div class="evt-pin-inner">${this.markerEmoji(ev.category)}</div></div>`,
      iconSize: [40, 48], iconAnchor: [20, 48]
    });
    L.marker([pos.lat, pos.lng], { icon }).addTo(this.detailMap)
      .bindPopup(`<b>${this.esc(ev.title)}</b><br>${this.esc(ev.location || '')}`);
    setTimeout(() => this.detailMap?.invalidateSize(), 100);
  }

  closeDetails() {
    this.selectedEvent = null;
    document.body.style.overflow = '';
    this.reviews = [];
    this.avgRating = 0;
    this.hasReviewed = false;
    this.newRating = 0;
    this.newComment = '';
    if (this.cdTimer) { clearInterval(this.cdTimer); this.cdTimer = null; }
    if (this.detailMap) { this.detailMap.remove(); this.detailMap = null; }
  }

  private startCountdown(dateStr: string) {
    if (this.cdTimer) clearInterval(this.cdTimer);
    const target = new Date(dateStr).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (isNaN(target) || diff <= 0) {
        this.countdown = { days: 0, hours: 0, mins: 0, secs: 0, past: true };
        if (this.cdTimer) { clearInterval(this.cdTimer); this.cdTimer = null; }
        this.cd.detectChanges();
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      this.countdown = { days, hours, mins, secs, past: false };
      this.cd.detectChanges();
    };
    tick();
    this.cdTimer = setInterval(() => this.zone.run(tick), 1000);
  }

  loadReviews(eventId: string) {
    this.loadingReviews = true;
    this.apiService.getFeedbacksByEvent(eventId).subscribe({
      next: list => {
        this.reviews = (list || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        this.hasReviewed = this.reviews.some(r => r.userId === this.userId);
        this.loadingReviews = false;
      },
      error: () => { this.loadingReviews = false; this.reviews = []; }
    });
    this.apiService.getAverageRating(eventId).subscribe({
      next: r => this.avgRating = r.averageRating || 0,
      error: () => this.avgRating = 0
    });
  }

  canRateEvent(): boolean {
    if (!this.selectedEvent || !this.userId) return false;
    if (this.hasReviewed) return false;
    // Must have a confirmed registration
    return this.myRegistrations.some(r => r.eventId === this.selectedEvent.id && r.status === 'CONFIRMED');
  }

  submitFeedback() {
    if (!this.newRating || !this.selectedEvent) return;
    this.submittingFeedback = true;
    this.apiService.createFeedback({
      eventId: this.selectedEvent.id,
      userId: this.userId,
      rating: this.newRating,
      comment: (this.newComment || '').trim()
    }).subscribe({
      next: (created) => {
        this.reviews = [created, ...this.reviews];
        this.hasReviewed = true;
        this.newRating = 0;
        this.newComment = '';
        this.submittingFeedback = false;
        this.showToast('Merci pour votre avis !', 'success');
        // Recompute average
        const total = this.reviews.reduce((s, r) => s + r.rating, 0);
        this.avgRating = total / this.reviews.length;
      },
      error: () => {
        this.submittingFeedback = false;
        this.showToast('Erreur lors de l\'envoi du feedback', 'error');
      }
    });
  }

  initialsOf(userId: string): string {
    return (userId || '?').substring(0, 2).toUpperCase();
  }

  /** Pourcentage des places RÉSERVÉES (0 = vide, 100 = complet). */
  getSeatsPct(ev: any): number {
    if (!ev.totalSeats) return 0;
    const avail = ev.availableSeats ?? ev.totalSeats;
    const reserved = ev.totalSeats - avail;
    return Math.round((reserved / ev.totalSeats) * 100);
  }

  /** Événement complet à partir d'un id (pour enrichir les billets du wallet). */
  getEvent(eventId: string): any {
    return this.events.find(e => e.id === eventId) || null;
  }
  getEventTitle(eventId: string): string {
    const ev = this.getEvent(eventId);
    return ev ? ev.title : `Événement ${this.shortId(eventId)}`;
  }

  // ─── Type / Format / Visio ───
  typeLabel(e: any): string { const t = (e?.type || '').toUpperCase(); return t === 'FORMATION' ? 'Formation' : t === 'WORKSHOP' ? 'Workshop' : t === 'CONFERENCE' ? 'Conférence' : t === 'SEMINAIRE' ? 'Séminaire' : 'Événement'; }
  modeLabel(e: any): string {
    const m = (e?.mode || '').toUpperCase();
    if (m === 'EN_LIGNE') return 'En ligne';
    if (m === 'HYBRIDE') return 'Hybride';
    return 'Présentiel';
  }
  isOnline(e: any): boolean {
    const m = (e?.mode || '').toUpperCase();
    return (m === 'EN_LIGNE' || m === 'HYBRIDE') && !!e?.visioLink;
  }

  /**
   * Référence courte affichée à l'utilisateur.
   *
   * On prend les DERNIERS caractères : les quatre premiers octets d'un ObjectId
   * MongoDB encodent l'horodatage de création, donc toutes les inscriptions
   * créées dans la même seconde partagent les huit premiers caractères — la
   * référence ne distinguait alors plus rien.
   */
  shortId(id: any): string {
    const s = String(id || '');
    return s.slice(-8).toUpperCase();
  }

  getQrUrl(regId: string): string {
    return this.apiService.getQrCodeUrl(`LINSOFT-TICKET-${regId}`, 144);
  }

  catGradient(cat: string): string { return categoryGradient(cat); }
  categoryColorOf(cat: string): string { return categoryColor(cat); }

  /** Sessions à venir groupées par mois (vue Planning). */
  get sessionsByMonth(): { key: string; date: any; items: any[] }[] {
    const floor = Date.now() - 86400000;
    let up = this.events.filter(e => new Date(e.eventDate || 0).getTime() > floor);
    if (this.planningMode === 'presentiel') up = up.filter(e => (e.mode || '').toUpperCase() === 'PRESENTIEL');
    if (this.planningMode === 'enligne') up = up.filter(e => { const m = (e.mode || '').toUpperCase(); return m === 'EN_LIGNE' || m === 'HYBRIDE'; });
    up.sort((a, b) => new Date(a.eventDate || 0).getTime() - new Date(b.eventDate || 0).getTime());
    const groups: Record<string, any[]> = {};
    const order: string[] = [];
    for (const e of up) {
      const d = new Date(e.eventDate);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(e);
    }
    return order.map(k => ({ key: k, date: groups[k][0].eventDate, items: groups[k] }));
  }

  register(eventId: string) {
    if (this.reservedSet.has(eventId) || this.pendingSet.has(eventId)) return;
    this.registering = eventId;
    const evTitle = this.getEvent(eventId)?.title || 'la session';
    // Workflow d'approbation : la demande part en attente de validation par un administrateur.
    this.apiService.requestRegistrationApproval(eventId, this.userId).subscribe({
      next: () => {
        this.registering = null;
        this.pendingSet.add(eventId);
        this.notifs.push('info', 'event', 'Demande envoyée', `${evTitle} — en attente de validation`, undefined, { path: '/user/wallet' });
        this.showToast('Demande envoyée. En attente de validation par un administrateur.', 'success');
        this.loadMyRegistrations();
      },
      error: (err) => {
        this.registering = null;
        const msg = err?.status === 403 ? 'Accès refusé' : err?.status === 400 ? 'Demande impossible (déjà inscrit ou en attente ?)' : 'Erreur lors de la demande';
        this.showToast(msg, 'error');
      }
    });
  }

  qrDataUrls: Record<string, string> = {};

  /**
   * Recharge les inscriptions avec leur suivi (avancement + certificat).
   * Le serveur recalcule l'avancement à chaque lecture : la page reflète l'état
   * réel de la session, sans attendre le prochain passage du planificateur.
   */
  loadMyRegistrations() {
    if (!this.userId) return;
    this.apiService.getAttendeeTracking(this.userId).subscribe(d => {
      this.zone.run(() => {
        this.myRegistrations = d || [];
        this.reservedSet = new Set(this.myRegistrations.filter(r => r.status === 'CONFIRMED').map(r => r.eventId));
        this.pendingSet = new Set(this.myRegistrations.filter(r => r.status === 'PENDING').map(r => r.eventId));
        this.announceCertificates();
        this.cd.detectChanges();
        // (Le QR reste disponible sur la page billet dédiée /ticket/:id — inutile de le charger ici.)
      });
    });
  }

  /**
   * Porte dans la cloche ce que le participant doit savoir : un certificat
   * délivré, ou une session close dont le certificat se prépare. Notifications
   * « vivantes » (seed) : elles se mettent à jour au lieu de s'empiler.
   */
  private announceCertificates(): void {
    const ready = this.certificatesReady;
    if (ready > 0) {
      this.notifs.seed('success', 'check', 'Certificat disponible',
        `${ready} certificat(s) de participation prêt(s) à télécharger`,
        'PARTICIPANT', { path: '/user/wallet' }, 'cert-ready');
    } else {
      this.notifs.drop('cert-ready', 'PARTICIPANT');
    }

    const preparing = this.certificatesPreparing;
    if (preparing > 0) {
      this.notifs.seed('info', 'event', 'Certificat en préparation',
        `${preparing} session(s) terminée(s) — certificat en cours de traitement`,
        'PARTICIPANT', { path: '/user/wallet' }, 'cert-preparing');
    } else {
      this.notifs.drop('cert-preparing', 'PARTICIPANT');
    }
  }

  /** Télécharge le certificat de participation (PDF) une fois délivré par l'admin. */
  downloadCertificate(reg: any): void {
    if (!reg?.certificateDownloadable || this.certBusy) return;
    this.certBusy = reg.id;
    this.apiService.downloadCertificate(reg.id).subscribe({
      next: blob => {
        this.zone.run(() => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `certificat-${this.shortId(reg.id)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          this.certBusy = null;
          this.showToast('Certificat téléchargé', 'success');
          this.cd.detectChanges();
        });
      },
      error: err => {
        this.zone.run(() => {
          this.certBusy = null;
          this.showToast(err?.status === 409
            ? "Votre certificat n'a pas encore été délivré par l'administrateur."
            : 'Certificat indisponible pour le moment.', 'error');
          this.cd.detectChanges();
        });
      }
    });
  }

  fetchQr(regId: string) {
    if (this.qrDataUrls[regId]) return;
    // Le QR encode l'URL publique du billet → scan = ouvre directement la page ticket
    const ticketUrl = `${window.location.origin}/ticket/${regId}`;
    this.apiService.getQrCodeBlob(ticketUrl, 200).subscribe({
      next: (blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          this.zone.run(() => {
            this.qrDataUrls[regId] = reader.result as string;
            this.cd.detectChanges();
          });
        };
        reader.readAsDataURL(blob);
      },
      error: () => {}
    });
  }

  cancelReg(id: string) {
    const reg = this.myRegistrations.find(r => r.id === id);
    const evTitle = reg ? this.getEventTitle(reg.eventId) : 'la session';
    this.apiService.cancelRegistration(id).subscribe({
      next: () => {
        this.notifs.push('warn', 'warn', 'Inscription annulée', `${evTitle}`, undefined, { path: '/user/wallet' });
        this.loadMyRegistrations();
        this.showToast('Inscription annulée', 'success');
      },
      error: () => this.showToast("Erreur lors de l'annulation", 'error')
    });
  }

  shareEvent(ev: any) {
    const url = window.location.origin + '/user';
    const text = `Formation/événement LINSOFT : "${ev.title}"`;
    if (navigator.share) {
      navigator.share({ title: ev.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(`${text} ${url}`);
      this.showToast('Lien copié dans le presse-papier', 'success');
    }
  }

  /** Libellé lisible du statut d'inscription. */
  regStatusLabel(s: string): string {
    switch (s) {
      case 'CONFIRMED': return 'Confirmée';
      case 'PENDING':   return 'En attente';
      case 'CANCELLED': return 'Annulée';
      case 'REJECTED':  return 'Refusée';
      default:          return s || '—';
    }
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toast = { message, type };
    setTimeout(() => this.toast = null, 3500);
  }
}
