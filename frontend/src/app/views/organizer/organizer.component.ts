import { Component, OnInit, inject, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { KeycloakService } from 'keycloak-angular';
import { GeoService } from '../../services/geo.service';
import { CATEGORIES, categoryColor, categoryGradient } from '../../shared/categories';
import { NotifsService } from '../../services/notifs.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-organizer',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="org">

      <!-- ─── TOP BAR ─── -->
      <header class="org-topbar">
        <div class="org-topbar-l">
          <div class="brand-pill">Espace formateur</div>
        </div>
        <div class="org-topbar-r">
          <span class="org-time">{{ now | date:'EEEE d MMMM' }}</span>
        </div>
      </header>

      <!-- ─── TABS ─── -->
      <nav class="org-tabs">
        <button class="org-tab" [class.active]="activeTab==='dashboard'" (click)="goTab('dashboard')">
          <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.6"/></svg>
          Vue d'ensemble
        </button>
        <button class="org-tab" [class.active]="activeTab==='events'" (click)="goTab('events')">
          <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.6"/><path d="M2 7h12M6 1.5V4M10 1.5V4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          Mes événements
          <span class="tab-count">{{ myEvents.length }}</span>
        </button>
      </nav>

      <!-- ════════════════════ DASHBOARD ════════════════════ -->
      <div *ngIf="activeTab==='dashboard'" class="org-content fade-in">

        <!-- KPIs personnels -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-head">
              <span class="kpi-label">Mes événements</span>
              <span class="kpi-pill">{{ upcomingCount }} à venir</span>
            </div>
            <div class="kpi-value">{{ myEvents.length }}</div>
            <div class="kpi-foot">{{ pastCount }} déjà passés</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-head">
              <span class="kpi-label">Inscriptions reçues</span>
              <span class="kpi-trend up">+{{ regsThisWeek }} cette sem.</span>
            </div>
            <div class="kpi-value">{{ totalRegistrations }}</div>
            <div class="kpi-foot">Tous événements confondus</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-head">
              <span class="kpi-label">Taux de présence</span>
            </div>
            <div class="kpi-value">{{ presenceRate }}<span class="kpi-unit">%</span></div>
            <div class="kpi-foot">Présences validées au check-in</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-head">
              <span class="kpi-label">Taux de remplissage</span>
            </div>
            <div class="kpi-value">{{ fillRate }}<span class="kpi-unit">%</span></div>
            <div class="kpi-progress">
              <div class="kpi-progress-fill" [style.width.%]="fillRate"></div>
            </div>
          </div>
        </div>

        <!-- Liste compacte de tes prochains événements -->
        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">Vos prochains événements</h2>
            <button class="link-btn" (click)="goTab('events')">Voir tout →</button>
          </div>
          <div class="panel-body p-0">
            <div *ngIf="loading" class="empty-state">Chargement…</div>
            <div *ngIf="!loading && upcomingEvents.length === 0" class="empty-state">
              <h3>Aucune session à venir</h3>
              <p>Utilisez « Créer un événement » dans le menu pour ouvrir les inscriptions à une nouvelle session.</p>
            </div>
            <div class="event-row" *ngFor="let e of upcomingEvents">
              <div class="er-date">
                <div class="er-d">{{ e.eventDate | date:'d' }}</div>
                <div class="er-m">{{ e.eventDate | date:'MMM' }}</div>
              </div>
              <div class="er-info">
                <div class="er-title">{{ e.title }}</div>
                <div class="er-meta">
                  <span class="er-cat">{{ e.category || '—' }}</span>
                  <span class="er-dot">·</span>
                  <span>{{ e.eventDate | date:'HH:mm' }}</span>
                  <span class="er-dot">·</span>
                  <span>{{ e.location || modeLabel(e) }}</span>
                </div>
              </div>
              <div class="er-stats">
                <div class="er-stat">
                  <div class="er-stat-v">{{ getReservedCount(e) }}</div>
                  <div class="er-stat-l">Inscrits</div>
                </div>
                <div class="er-stat">
                  <div class="er-stat-v">{{ getRemainingPct(e) }}%</div>
                  <div class="er-stat-l">Disponible</div>
                </div>
                <div class="er-stat">
                  <div class="er-stat-v">{{ getPresentCount(e) }}</div>
                  <div class="er-stat-l">Présents</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Top catégories de TES events -->
        <section class="panel" *ngIf="myCategoryStats.length > 0">
          <div class="panel-head">
            <h2 class="panel-title">Vos catégories</h2>
          </div>
          <div class="panel-body">
            <div class="cat-stat" *ngFor="let c of myCategoryStats">
              <div class="cat-stat-row">
                <span class="cat-dot" [style.background]="c.color"></span>
                <span class="cat-name">{{ c.name }}</span>
                <span class="cat-count">{{ c.count }} événement(s)</span>
              </div>
              <div class="cat-bar">
                <div class="cat-bar-fill" [style.width.%]="c.pct" [style.background]="c.color"></div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ════════════════════ EVENTS LIST ════════════════════ -->
      <div *ngIf="activeTab==='events'" class="org-content fade-in">
        <section class="panel">
          <div class="panel-head">
            <h2 class="panel-title">Mes événements <span class="panel-count">{{ myEvents.length }}</span></h2>
            <div class="filter-bar">
              <div class="segmented">
                <button [class.active]="evFilter==='all'" (click)="evFilter='all'">Tous</button>
                <button [class.active]="evFilter==='upcoming'" (click)="evFilter='upcoming'">À venir</button>
                <button [class.active]="evFilter==='past'" (click)="evFilter='past'">Passés</button>
              </div>
            </div>
          </div>

          <div *ngIf="loading" class="loading-state">Chargement…</div>
          <div *ngIf="!loading && filteredEvents.length === 0" class="empty-state">
            <div class="empty-ico">🎯</div>
            <h3>{{ evFilter === 'all' ? 'Aucun événement publié' : 'Aucun événement ' + (evFilter === 'upcoming' ? 'à venir' : 'passé') }}</h3>
            <p>Utilisez « Créer un événement » dans le menu pour en ajouter un.</p>
          </div>

          <div *ngIf="!loading && filteredEvents.length > 0" class="event-grid">
            <article *ngFor="let e of filteredEvents" class="event-tile">
              <div class="event-tile-img" [style.background]="catGradient(e.category)">
                <div class="et-date">
                  <div class="et-d">{{ e.eventDate | date:'d' }}</div>
                  <div class="et-m">{{ e.eventDate | date:'MMM' }}</div>
                </div>
                <span class="et-cat" [class]="'cat-' + (e.category || '').toLowerCase()">{{ e.category || '—' }}</span>
                <span class="et-status" [class.past]="isPast(e)">{{ isPast(e) ? 'Passé' : 'À venir' }}</span>
                <span class="et-mod et-mod-{{ modKey(e) }}">{{ modLabel(e) }}</span>
              </div>
              <div class="event-tile-body">
                <h3 class="et-title">{{ e.title }}</h3>
                <div class="et-meta">
                  <span><svg viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.4"/><path d="M7 4v3l2 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>{{ e.eventDate | date:'HH:mm' }}</span>
                  <span><svg viewBox="0 0 14 14" fill="none"><path d="M7 12s4-3.5 4-7a4 4 0 0 0-8 0c0 3.5 4 7 4 7z" stroke="currentColor" stroke-width="1.4"/></svg>{{ e.location || modeLabel(e) }}</span>
                </div>
                <div class="et-fill-row">
                  <span class="et-fill-label">{{ getReservedCount(e) }} / {{ e.totalSeats || 0 }} places</span>
                  <span class="et-fill-pct">{{ getReservedPct(e) }}%</span>
                </div>
                <div class="et-fill-bar">
                  <div class="et-fill" [style.width.%]="getReservedPct(e)"></div>
                </div>
                <!-- Demande déposée : l'organisateur attend la décision de l'admin -->
                <div class="et-pending" *ngIf="e.pendingChange">
                  <div class="et-pending-t">
                    {{ e.pendingChange.type === 'CANCEL' ? 'Annulation demandée' : 'Modification demandée' }}
                    · en attente de validation
                  </div>
                  <div class="et-pending-r" *ngIf="e.pendingChange.reason">« {{ e.pendingChange.reason }} »</div>
                  <button class="et-pending-x" (click)="withdrawChange(e)" [disabled]="changeBusy === e.id">
                    Retirer ma demande
                  </button>
                </div>

                <!-- Issue de la dernière demande, tant que le formateur n'en a pas pris acte -->
                <div class="et-decision" *ngIf="e.lastChangeDecision"
                     [class.et-decision-ko]="e.lastChangeDecision.outcome === 'REJECTED'">
                  <div class="et-decision-t">{{ decisionLabel(e.lastChangeDecision) }}</div>
                  <div class="et-decision-d" *ngIf="e.lastChangeDecision.outcome === 'REJECTED'">
                    La session reste inchangée. Vous pouvez déposer une nouvelle demande.
                  </div>
                  <button class="et-pending-x" (click)="ackDecision(e)" [disabled]="changeBusy === e.id">
                    J'ai compris
                  </button>
                </div>

                <!-- Session annulée : état terminal, plus aucune action -->
                <div class="et-cancelled" *ngIf="isCancelled(e)">
                  Session annulée<span *ngIf="e.cancelReason"> — {{ e.cancelReason }}</span>
                </div>

                <div class="et-footer">
                  <span class="et-format">{{ typeLabel(e) }} · {{ modeLabel(e) }}</span>

                  <ng-container *ngIf="!e.pendingChange && !isCancelled(e) && deleteConfirm !== e.id">
                    <button class="et-act" (click)="openEdit(e)">Modifier</button>
                    <button class="et-act et-act-danger" (click)="openCancel(e)">Annuler</button>
                  </ng-container>

                  <button *ngIf="deleteConfirm !== e.id" class="icon-btn icon-danger" (click)="deleteConfirm = e.id" title="Supprimer">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M5 4l1 9a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1l1-9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  </button>
                  <div *ngIf="deleteConfirm === e.id" class="confirm-inline">
                    <button class="cf-yes" (click)="deleteEvent(e.id)">Supprimer</button>
                    <button class="cf-no" (click)="deleteConfirm = null">Garder</button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- ════════════════════ CREATE ════════════════════ -->
      <div *ngIf="activeTab==='create'" class="org-content fade-in">

        <!-- ÉTAPE 1 : choix du type de session -->
        <div *ngIf="createStep==='choose'" class="type-choose">
          <h2 class="tc-title">Que souhaitez-vous créer ?</h2>
          <p class="tc-sub">Choisissez un type de session — chacun a son propre formulaire de création.</p>
          <div class="tc-grid">
            <button type="button" class="tc-card" *ngFor="let t of sessionTypes" (click)="setSessionType(t.value)">
              <span class="tc-badge">{{ t.name.charAt(0) }}</span>
              <span class="tc-name">{{ t.name }}</span>
              <span class="tc-desc">{{ t.sub }}</span>
              <span class="tc-go">Créer →</span>
            </button>
          </div>
        </div>

        <!-- ÉTAPE 2 : formulaire dédié au type choisi -->
        <div *ngIf="createStep==='form'" class="create-wrap">
          <aside class="create-aside">
            <button type="button" class="back-link" (click)="backToChoose()">← Changer de type</button>
            <h2 class="create-title">Nouvelle {{ sessionTypeName | lowercase }}</h2>
            <p class="create-desc" *ngIf="sessionType==='FORMATION'">Cursus certifiant : renseignez l'éditeur, la certification visée, le niveau et la durée.</p>
            <p class="create-desc" *ngIf="sessionType==='WORKSHOP'">Atelier pratique : renseignez le thème, le niveau, la durée et les prérequis.</p>
            <p class="create-desc" *ngIf="sessionType==='CONFERENCE'">Talk thématique : renseignez le thème et le ou les intervenants.</p>
            <p class="create-desc create-desc-mut">La session sera publiée après validation par un administrateur.</p>
          </aside>

          <form [formGroup]="eventForm" (ngSubmit)="$event.preventDefault(); createEvent()" class="create-form">
            <div class="form-group">
              <label class="form-label">Titre <span class="req">*</span></label>
              <input class="form-input" formControlName="title"
                [placeholder]="titlePlaceholder"
                [class.invalid]="eventForm.get('title')?.invalid && eventForm.get('title')?.touched">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">{{ categoryLabel }} <span class="req">*</span></label>
                <select class="form-input" formControlName="category">
                  <option *ngFor="let c of categories" [value]="c">{{ c }}</option>
                </select>
              </div>
              <!-- Formation : certification visée -->
              <div class="form-group" *ngIf="sessionType === 'FORMATION'">
                <label class="form-label">Certification visée</label>
                <input class="form-input" formControlName="certification" placeholder="Ex : RHCSA, AWS SAA-C03…">
              </div>
              <!-- Conférence : intervenant -->
              <div class="form-group" *ngIf="sessionType === 'CONFERENCE'">
                <label class="form-label">Intervenant(s)</label>
                <input class="form-input" formControlName="speaker" placeholder="Ex : Med Amine Khadhraoui">
              </div>
            </div>

            <!-- Formation / Workshop : niveau + durée -->
            <div class="form-row" *ngIf="sessionType === 'FORMATION' || sessionType === 'WORKSHOP'">
              <div class="form-group">
                <label class="form-label">Niveau</label>
                <select class="form-input" formControlName="level">
                  <option value="">— Choisir —</option>
                  <option value="Débutant">Débutant</option>
                  <option value="Intermédiaire">Intermédiaire</option>
                  <option value="Avancé">Avancé</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Durée ({{ durationUnit }})</label>
                <input type="number" min="1" class="form-input" formControlName="durationValue"
                  [placeholder]="sessionType === 'FORMATION' ? 'Ex : 4' : 'Ex : 3'">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Format <span class="req">*</span></label>
                <select class="form-input" formControlName="mode">
                  <option value="PRESENTIEL">Présentiel</option>
                  <option value="EN_LIGNE">En ligne</option>
                  <option value="HYBRIDE">Hybride</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Date & heure <span class="req">*</span></label>
                <input type="datetime-local" class="form-input" formControlName="eventDate"
                  [class.invalid]="eventForm.get('eventDate')?.invalid && eventForm.get('eventDate')?.touched">
              </div>
            </div>
            <div class="form-group" *ngIf="eventForm.get('mode')?.value !== 'PRESENTIEL'">
              <label class="form-label">Lien visio</label>
              <input class="form-input" formControlName="visioLink" placeholder="https://meet… / zoom… / teams…">
            </div>
            <div class="form-group">
              <label class="form-label">Lieu <span class="req">*</span></label>
              <input class="form-input" formControlName="location" placeholder="Ex : Tunis, LINSOFT"
                (input)="onLocationChange()"
                [class.invalid]="eventForm.get('location')?.invalid && eventForm.get('location')?.touched">
              <!-- Carte de prévisualisation du lieu -->
              <div class="create-map-wrap">
                <div id="create-map" class="create-map"></div>
                <div class="create-map-hint">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M8 14s5-4.5 5-8a5 5 0 1 0-10 0c0 3.5 5 8 5 8z" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="6" r="1.8" stroke="currentColor" stroke-width="1.5"/></svg>
                  <strong>Cliquez sur la carte</strong> pour placer le pin (ou déplacez-le), ou tapez une ville
                  <span *ngIf="eventForm.get('latitude')?.value" class="coords-tag">📍 {{ eventForm.get('latitude')?.value }}, {{ eventForm.get('longitude')?.value }}</span>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Nombre de places <span class="req">*</span></label>
              <input type="number" class="form-input" formControlName="totalSeats" min="1"
                [class.invalid]="eventForm.get('totalSeats')?.invalid && eventForm.get('totalSeats')?.touched">
            </div>

            <!-- Formation / Workshop : prérequis -->
            <div class="form-group" *ngIf="sessionType === 'FORMATION' || sessionType === 'WORKSHOP'">
              <label class="form-label">Prérequis</label>
              <textarea class="form-input form-textarea" formControlName="prerequisites" rows="2" placeholder="Ex : bases Linux, notions de réseau, compte AWS…"></textarea>
            </div>

            <div class="form-group">
              <label class="form-label">{{ sessionType === 'CONFERENCE' ? 'Description' : 'Programme & objectifs' }}</label>
              <textarea class="form-input form-textarea" formControlName="description" rows="4"
                [placeholder]="sessionType === 'CONFERENCE' ? 'Sujet, intervenant, déroulé…' : 'Modules, compétences acquises, déroulé…'"></textarea>
            </div>

            <div class="form-actions">
              <button type="button" class="btn-ghost" (click)="goTab('dashboard')">Annuler</button>
              <button type="submit" class="btn-primary" [disabled]="creating">
                <span *ngIf="!creating">Soumettre pour validation</span>
                <span *ngIf="creating">Envoi…</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ════════════════════ DEMANDE SUR UNE SESSION PUBLIÉE ════════════════════ -->
      <div class="ch-overlay" *ngIf="changeTarget" (click)="closeChange()"></div>
      <aside class="ch-panel" *ngIf="changeTarget">
        <header class="ch-head">
          <div>
            <h3 class="ch-title">{{ changeMode === 'cancel' ? 'Annuler la session' : 'Modifier la session' }}</h3>
            <p class="ch-sub">{{ changeTarget.title }}</p>
          </div>
          <button class="ch-x" (click)="closeChange()" aria-label="Fermer">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </header>

        <p class="ch-notice">
          {{ changeMode === 'cancel'
              ? "Des collaborateurs sont peut-être déjà inscrits : l'annulation est soumise à l'administrateur. Une fois approuvée, tous les inscrits reçoivent le motif que vous indiquez ici."
              : "La session reste inchangée au catalogue jusqu'à l'approbation de l'administrateur. Les inscrits seront alors prévenus du détail des changements." }}
        </p>

        <!-- Formulaire de modification -->
        <div class="ch-form" *ngIf="changeMode === 'edit'">
          <div class="form-group">
            <label class="form-label">Intitulé</label>
            <input class="form-input" [(ngModel)]="changeForm.title">
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date &amp; heure</label>
              <input type="datetime-local" class="form-input" [(ngModel)]="changeForm.eventDate">
            </div>
            <div class="form-group">
              <label class="form-label">Nombre de places</label>
              <input type="number" min="1" class="form-input" [(ngModel)]="changeForm.totalSeats">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Format</label>
              <select class="form-input" [(ngModel)]="changeForm.mode">
                <option value="PRESENTIEL">Présentiel</option>
                <option value="EN_LIGNE">En ligne</option>
                <option value="HYBRIDE">Hybride</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Lieu</label>
              <input class="form-input" [(ngModel)]="changeForm.location">
            </div>
          </div>
          <div class="form-group" *ngIf="changeForm.mode !== 'PRESENTIEL'">
            <label class="form-label">Lien de visioconférence</label>
            <input class="form-input" [(ngModel)]="changeForm.visioLink" placeholder="https://meet…">
          </div>
          <div class="form-group">
            <label class="form-label">Programme &amp; objectifs</label>
            <textarea class="form-input form-textarea" rows="4" [(ngModel)]="changeForm.description"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Précision pour les inscrits <span class="ch-opt">(facultatif)</span></label>
            <textarea class="form-input form-textarea" rows="2" [(ngModel)]="changeForm.reason"
                      placeholder="Ex : la salle a changé pour accueillir plus de participants."></textarea>
          </div>
        </div>

        <!-- Formulaire d'annulation -->
        <div class="ch-form" *ngIf="changeMode === 'cancel'">
          <div class="form-group">
            <label class="form-label">Motif de l'annulation <span class="req">*</span></label>
            <textarea class="form-input form-textarea" rows="4" [(ngModel)]="changeForm.reason"
                      placeholder="Ex : le formateur est indisponible à cette date, la session sera reprogrammée en septembre."></textarea>
            <span class="ch-hint">Ce texte est transmis tel quel aux inscrits. Soyez précis : c'est la seule explication qu'ils recevront.</span>
          </div>
        </div>

        <footer class="ch-actions">
          <button class="btn-ghost" (click)="closeChange()">Fermer</button>
          <button class="btn-primary" (click)="submitChange()" [disabled]="changeBusy === changeTarget.id">
            {{ changeBusy === changeTarget.id ? 'Envoi…' : 'Soumettre à validation' }}
          </button>
        </footer>
      </aside>

      <!-- Toast -->
      <div *ngIf="toast" class="toast" [class.t-success]="toast.type==='success'" [class.t-error]="toast.type==='error'">
        <svg *ngIf="toast.type==='success'" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg *ngIf="toast.type==='error'" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v5M8 11v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span>{{ toast.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .org { font-family: 'Inter', -apple-system, system-ui, sans-serif; color: var(--text-primary); padding-bottom: 60px; }
    .org * { box-sizing: border-box; }
    .fade-in { animation: fadeIn 0.3s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .mt-2 { margin-top: 14px; }

    /* Topbar */
    .org-topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; margin-bottom: 24px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 12px; }
    .brand-pill { display: inline-flex; align-items: center; gap: 8px; background: var(--accent-primary-soft, #fdeceb); color: var(--accent-primary, #e30613); padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; }
    .org-topbar-r { display: flex; align-items: center; gap: 14px; }
    .org-time { font-size: 13px; color: var(--text-tertiary); }
    .btn-primary { display: inline-flex; align-items: center; gap: 7px; background: var(--text-primary); color: var(--surface-base); border: none; padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s ease; }
    .btn-primary svg { width: 14px; height: 14px; }
    .btn-primary:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-ghost { background: var(--surface-base); color: var(--text-primary); border: 1px solid var(--border-default); padding: 9px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .btn-ghost:hover { background: var(--surface-subtle); }

    /* Tabs */
    .org-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 28px; }
    .org-tab { display: inline-flex; align-items: center; gap: 7px; background: transparent; border: none; padding: 10px 14px; font-size: 14px; font-weight: 500; color: var(--text-secondary); cursor: pointer; font-family: inherit; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color 0.15s ease; }
    .org-tab svg { width: 15px; height: 15px; }
    .org-tab:hover { color: var(--text-primary); }
    .org-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); }
    .tab-count { font-size: 11px; color: var(--text-tertiary); background: var(--surface-muted); padding: 1px 7px; border-radius: 20px; font-weight: 500; }
    .org-tab.active .tab-count { color: var(--text-primary); background: var(--surface-subtle); }

    /* Content */
    .org-content { display: flex; flex-direction: column; gap: 20px; }

    /* KPI Grid */
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 1024px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
    .kpi-card { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 20px 22px; transition: all 0.2s ease; }
    .kpi-card:hover { border-color: var(--border-default); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
    .kpi-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .kpi-label { font-size: 12px; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.6px; }
    .kpi-trend { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--accent-success-soft); color: var(--accent-success); }
    .kpi-pill { font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 20px; background: var(--surface-muted); color: var(--text-tertiary); }
    .kpi-value { font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1; color: var(--accent-primary); font-variant-numeric: tabular-nums; }
    .kpi-unit { font-size: 14px; color: var(--text-tertiary); font-weight: 500; }
    .kpi-foot { font-size: 12px; color: var(--text-tertiary); margin-top: 10px; }
    .kpi-progress { height: 6px; background: var(--surface-muted); border-radius: 99px; overflow: hidden; margin-top: 14px; }
    .kpi-progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent-primary, #e30613), #ff3341); border-radius: 99px; transition: width 0.6s ease; }

    /* Panel */
    .panel { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 12px; }
    .panel-title { font-size: 16px; font-weight: 700; letter-spacing: -0.2px; margin: 0; }
    .panel-count { font-size: 13px; color: var(--text-tertiary); font-weight: 500; margin-left: 6px; }
    .panel-body { padding: 22px; }
    .panel-body.p-0 { padding: 0; }
    .link-btn { background: none; border: none; color: var(--accent-primary); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; padding: 0; }
    .link-btn:hover { color: var(--accent-primary-hover); }

    /* Event row (compact list) */
    .event-row { display: flex; align-items: center; gap: 16px; padding: 14px 22px; transition: background 0.12s ease; }
    .event-row + .event-row { border-top: 1px solid var(--border-subtle); }
    .event-row:hover { background: var(--surface-subtle); }
    .er-date { width: 52px; height: 52px; flex-shrink: 0; text-align: center; padding: 8px 0; background: var(--surface-subtle); border-radius: 10px; }
    .er-d { font-size: 18px; font-weight: 700; line-height: 1; }
    .er-m { font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary); margin-top: 3px; font-weight: 600; }
    .er-info { flex: 1; min-width: 0; }
    .er-title { font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
    .er-meta { display: flex; gap: 6px; font-size: 12px; color: var(--text-tertiary); flex-wrap: wrap; }
    .er-cat { color: var(--accent-primary); font-weight: 600; }
    .er-dot { opacity: 0.5; }
    .er-stats { display: flex; gap: 24px; }
    .er-stat { text-align: right; }
    .er-stat-v { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .er-stat-l { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px; }

    /* Category stats */
    .cat-stat { margin-bottom: 14px; }
    .cat-stat:last-child { margin-bottom: 0; }
    .cat-stat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .cat-dot { width: 9px; height: 9px; border-radius: 3px; }
    .cat-name { font-size: 13px; font-weight: 500; flex: 1; }
    .cat-count { font-size: 12px; color: var(--text-tertiary); }
    .cat-bar { height: 6px; background: var(--surface-muted); border-radius: 99px; overflow: hidden; }
    .cat-bar-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }

    /* Event grid (cards) */
    .event-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; padding: 20px 22px; }
    .event-tile { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; overflow: hidden; transition: all 0.2s ease; }
    .event-tile:hover { border-color: var(--border-default); box-shadow: var(--shadow-md); transform: translateY(-2px); }
    .event-tile-img { position: relative; height: 140px; background-size: cover; background-position: center; }
    .et-date { position: absolute; top: 10px; left: 10px; background: rgba(255,255,255,0.96); backdrop-filter: blur(6px); padding: 5px 10px; border-radius: 9px; text-align: center; }
    .et-d { font-size: 16px; font-weight: 700; line-height: 1; }
    .et-m { font-size: 9px; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.6px; margin-top: 2px; font-weight: 600; }
    .et-cat { position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); color: white; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .et-status { position: absolute; bottom: 10px; right: 10px; background: rgba(16,185,129,0.95); color: white; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .et-status.past { background: rgba(115,115,120,0.95); }
    .et-mod { position: absolute; bottom: 10px; left: 10px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; backdrop-filter: blur(4px); }
    .et-mod-pending  { background: rgba(217,119,6,0.95); color: #fff; }
    .et-mod-approved { background: rgba(5,150,105,0.95); color: #fff; }
    .et-mod-rejected { background: rgba(220,38,38,0.95); color: #fff; }

    .event-tile-body { padding: 16px; }
    .et-title { font-size: 15px; font-weight: 700; margin: 0 0 10px; line-height: 1.35; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .et-meta { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
    .et-meta span { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-tertiary); }
    .et-meta svg { width: 12px; height: 12px; }
    .et-fill-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .et-fill-label { font-size: 11px; color: var(--text-tertiary); }
    .et-fill-pct { font-size: 12px; font-weight: 700; color: var(--text-primary); }
    .et-fill-bar { height: 5px; background: var(--surface-muted); border-radius: 99px; overflow: hidden; margin-bottom: 14px; }
    .et-fill { height: 100%; background: linear-gradient(90deg, var(--accent-primary, #e30613), #ff3341); border-radius: 99px; transition: width 0.5s ease; }
    .et-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-subtle); }
    .et-format { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

    /* Filter */
    .filter-bar { display: flex; gap: 8px; }
    .segmented { display: flex; background: var(--surface-muted); border-radius: 8px; padding: 3px; }
    .segmented button { background: transparent; border: none; padding: 6px 14px; font-size: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer; border-radius: 6px; font-family: inherit; transition: all 0.15s ease; }
    .segmented button:hover { color: var(--text-primary); }
    .segmented button.active { background: var(--surface-base); color: var(--text-primary); box-shadow: var(--shadow-xs); }

    /* Icon button */
    .icon-btn { width: 30px; height: 30px; border-radius: 7px; border: 1px solid transparent; background: transparent; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-tertiary); transition: all 0.15s ease; }
    .icon-btn svg { width: 14px; height: 14px; }
    .icon-btn:hover { background: var(--surface-muted); color: var(--text-primary); }
    .icon-danger:hover { background: var(--accent-danger-soft); color: var(--accent-danger); }
    .confirm-inline { display: inline-flex; gap: 6px; }
    .cf-yes { background: var(--accent-danger); color: white; border: none; padding: 5px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .cf-no { background: var(--surface-base); border: 1px solid var(--border-default); padding: 5px 10px; border-radius: 6px; font-size: 11px; color: var(--text-secondary); cursor: pointer; font-family: inherit; }

    /* Empty / loading */
    .empty-state { text-align: center; padding: 60px 24px; }
    .empty-ico { font-size: 3rem; margin-bottom: 14px; opacity: 0.6; }
    .empty-state h3 { font-size: 16px; font-weight: 700; margin: 0 0 6px; }
    .empty-state p { font-size: 13px; color: var(--text-tertiary); margin: 0; }
    .loading-state { padding: 60px 24px; text-align: center; color: var(--text-tertiary); }

    /* Create form */
    /* Étape 1 : écran de choix du type */
    .type-choose { text-align: center; padding: 24px 0 8px; }
    .tc-title { font-size: 24px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 8px; }
    .tc-sub { font-size: 14px; color: var(--text-secondary); margin: 0 0 28px; }
    .tc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; max-width: 840px; margin: 0 auto; }
    @media (max-width: 760px) { .tc-grid { grid-template-columns: 1fr; } }
    .tc-card { display: flex; flex-direction: column; align-items: center; gap: 8px; text-align: center; padding: 30px 22px; background: var(--surface-base); border: 1.5px solid var(--border-default, #e4e4e7); border-radius: 16px; cursor: pointer; font-family: inherit; transition: all 0.2s ease; }
    .tc-card:hover { border-color: var(--accent-primary, #e30613); transform: translateY(-3px); box-shadow: 0 14px 30px rgba(227, 6, 19,0.12); }
    .tc-badge { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #fff; background: linear-gradient(135deg, #e30613, #a30f0a); margin-bottom: 6px; }
    .tc-name { font-size: 17px; font-weight: 700; color: var(--text-primary); }
    .tc-desc { font-size: 12.5px; color: var(--text-tertiary); line-height: 1.5; }
    .tc-go { margin-top: 8px; font-size: 12px; font-weight: 700; color: var(--accent-primary, #e30613); text-transform: uppercase; letter-spacing: 0.5px; }

    /* Étape 2 : formulaire dédié */
    .back-link { background: none; border: none; padding: 0 0 14px; color: var(--accent-primary, #e30613); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .back-link:hover { text-decoration: underline; }
    .create-desc-mut { color: var(--text-tertiary); font-size: 12px; }

    .create-wrap { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 16px; padding: 32px; display: grid; grid-template-columns: 300px 1fr; gap: 36px; }
    @media (max-width: 968px) { .create-wrap { grid-template-columns: 1fr; } }
    .create-title { font-size: 22px; font-weight: 700; letter-spacing: -0.4px; margin: 0 0 12px; text-transform: capitalize; }
    .create-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 14px; }
    .req { color: var(--accent-danger); }
    .tips { display: flex; flex-direction: column; gap: 14px; }
    .tip { display: flex; gap: 10px; align-items: flex-start; }
    .tip-num { width: 24px; height: 24px; border-radius: 50%; background: var(--accent-primary-soft); color: var(--accent-primary); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
    .tip strong { font-size: 13px; font-weight: 600; display: block; }
    .tip-sub { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
    .create-form { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; gap: 6px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    /* ── Demandes de l'organisateur sur une session publiée ── */
    .et-act {
      background: transparent; border: 1px solid var(--border-default); color: var(--text-secondary);
      padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: all 0.15s ease;
    }
    .et-act:hover { background: var(--surface-subtle); color: var(--text-primary); }
    .et-act-danger:hover { background: var(--accent-danger-soft, #fef2f2); color: var(--accent-danger, #dc2626); border-color: transparent; }

    .et-pending {
      display: flex; flex-direction: column; gap: 4px;
      margin: 10px 0 0; padding: 10px 12px;
      background: var(--accent-primary-soft, #fdeceb);
      border-left: 2px solid var(--accent-primary, #e30613);
      border-radius: 0 8px 8px 0;
    }
    .et-pending-t { font-size: 12px; font-weight: 700; color: var(--accent-primary, #e30613); }
    .et-pending-r { font-size: 12px; color: var(--text-secondary); font-style: italic; }
    .et-pending-x {
      align-self: flex-start; margin-top: 2px; padding: 0;
      background: none; border: none; font-family: inherit;
      font-size: 11.5px; font-weight: 600; color: var(--text-secondary);
      text-decoration: underline; cursor: pointer;
    }
    .et-pending-x:hover { color: var(--text-primary); }
    .et-pending-x:disabled { opacity: 0.5; cursor: wait; }

    .et-cancelled {
      margin: 10px 0 0; padding: 9px 12px; border-radius: 8px;
      background: var(--surface-muted); color: var(--text-tertiary);
      font-size: 12px; font-weight: 600;
    }

    /* Issue d'une demande tranchée : vert si appliquée, rouge si écartée */
    .et-decision {
      display: flex; flex-direction: column; gap: 4px;
      margin: 10px 0 0; padding: 10px 12px; border-radius: 0 8px 8px 0;
      background: var(--accent-success-soft, #ecfdf5);
      border-left: 2px solid var(--accent-success, #10b981);
    }
    .et-decision-t { font-size: 12px; font-weight: 700; color: var(--accent-success, #10b981); }
    .et-decision.et-decision-ko { background: var(--accent-danger-soft, #fef2f2); border-left-color: var(--accent-danger, #dc2626); }
    .et-decision.et-decision-ko .et-decision-t { color: var(--accent-danger, #dc2626); }
    .et-decision-d { font-size: 12px; color: var(--text-secondary); }

    /* Panneau latéral de demande */
    .ch-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.42); z-index: 900; animation: fadeIn 0.2s ease; }
    .ch-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: min(560px, 100%);
      background: var(--surface-base); border-left: 1px solid var(--border-subtle);
      z-index: 901; display: flex; flex-direction: column; gap: 18px;
      padding: 24px; overflow-y: auto;
      box-shadow: -18px 0 48px rgba(0,0,0,0.14);
      animation: chIn 0.26s cubic-bezier(0.2, 0.8, 0.25, 1);
    }
    @keyframes chIn { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }
    .ch-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
    .ch-title { font-size: 19px; font-weight: 700; letter-spacing: -0.3px; margin: 0 0 3px; }
    .ch-sub { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .ch-x {
      flex-shrink: 0; width: 30px; height: 30px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--surface-subtle); border: none; color: var(--text-secondary); cursor: pointer;
    }
    .ch-x:hover { background: var(--surface-muted); color: var(--text-primary); }
    .ch-x svg { width: 13px; height: 13px; }
    .ch-notice {
      margin: 0; padding: 12px 14px; border-radius: 9px;
      background: var(--surface-subtle); border-left: 2px solid var(--accent-primary, #e30613);
      font-size: 13px; line-height: 1.55; color: var(--text-secondary);
    }
    .ch-form { display: flex; flex-direction: column; gap: 14px; }
    .ch-opt { font-weight: 500; color: var(--text-tertiary); }
    .ch-hint { font-size: 11.5px; color: var(--text-tertiary); line-height: 1.5; }
    .ch-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: auto; padding-top: 8px; }
    @media (prefers-reduced-motion: reduce) { .ch-panel { animation: none; } }
    /* Sélecteur de type de session */
    .type-picker { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    @media (max-width: 640px) { .type-picker { grid-template-columns: 1fr; } }
    .tp-card { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; padding: 14px 16px; border: 1.5px solid var(--border-default, #e4e4e7); background: var(--surface-base, #fff); border-radius: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .tp-card:hover { border-color: var(--accent-primary, #e30613); }
    .tp-card.sel { border-color: var(--accent-primary, #e30613); background: var(--accent-primary-soft, #fdeceb); box-shadow: 0 0 0 3px rgba(227, 6, 19,0.1); }
    .tp-name { font-size: 14px; font-weight: 700; color: var(--text-primary, #18181b); }
    .tp-card.sel .tp-name { color: var(--accent-primary, #e30613); }
    .tp-sub { font-size: 11.5px; color: var(--text-tertiary, #71717a); line-height: 1.4; }
    .form-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .form-input { background: var(--surface-base); border: 1px solid var(--border-default); border-radius: 8px; padding: 10px 14px; font-size: 14px; font-family: inherit; color: var(--text-primary); outline: none; transition: all 0.15s ease; }
    .create-map-wrap { margin-top: 10px; border-radius: 12px; overflow: hidden; border: 1px solid var(--border-default); }
    .create-map { width: 100%; height: 200px; background: #0c0c14; }
    .create-map-hint { display: flex; align-items: center; flex-wrap: wrap; gap: 7px; padding: 9px 14px; background: var(--surface-subtle); font-size: 11px; color: var(--text-tertiary); font-weight: 500; }
    .create-map-hint svg { width: 13px; height: 13px; color: var(--accent-primary); flex-shrink: 0; }
    .create-map-hint strong { color: var(--text-secondary); }
    .coords-tag { margin-left: auto; font-family: monospace; background: var(--accent-primary-soft); color: var(--accent-primary); padding: 2px 8px; border-radius: 6px; font-weight: 600; }
    .form-input:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px rgba(227, 6, 19,0.1); }
    .form-input.invalid { border-color: var(--accent-danger); }
    .form-textarea { resize: vertical; min-height: 90px; }
    .form-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--border-subtle); }

    /* Toast */
    .toast { position: fixed; bottom: 24px; right: 24px; display: flex; align-items: center; gap: 10px; background: #1a1a1a; color: white; padding: 12px 16px; border-radius: 10px; font-size: 13px; font-weight: 500; box-shadow: 0 12px 32px rgba(0,0,0,0.2); z-index: 9999; animation: toastIn 0.3s ease; }
    @keyframes toastIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .toast svg { width: 16px; height: 16px; flex-shrink: 0; }
    .t-success svg { color: #4ade80; }
    .t-error svg { color: #f87171; }
  `]
})
export class OrganizerComponent implements OnInit {
  private apiService = inject(ApiService);
  private keycloak = inject(KeycloakService);
  private fb = inject(FormBuilder);
  private cd = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private geo = inject(GeoService);
  private createMap: L.Map | null = null;
  private createMarker: L.Marker | null = null;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private notifs = inject(NotifsService);

  activeTab: 'dashboard' | 'events' | 'create' = 'dashboard';
  evFilter: 'all' | 'upcoming' | 'past' = 'all';
  categories = CATEGORIES;
  myEvents: any[] = [];
  allRegistrations: any[] = [];
  organizerId = '';
  organizerEmail = '';
  organizerName = '';
  loading = false;
  creating = false;
  deleteConfirm: string | null = null;
  toast: { message: string; type: 'success' | 'error' } | null = null;
  now = new Date();

  // ─── Demande de modification / d'annulation sur une session publiée ───
  changeTarget: any = null;
  changeMode: 'edit' | 'cancel' = 'edit';
  changeBusy: string | null = null;
  changeForm: any = {};

  isCancelled(e: any): boolean { return (e?.status || '').toUpperCase() === 'CANCELLED'; }

  /** Phrase d'issue affichée sur la vignette. */
  decisionLabel(d: any): string {
    const cancel = d?.type === 'CANCEL';
    return d?.outcome === 'APPROVED'
      ? (cancel ? 'Annulation approuvée — les inscrits ont été prévenus'
                : 'Modification approuvée — les inscrits ont été prévenus')
      : (cancel ? "Annulation refusée par l'administrateur"
                : "Modification refusée par l'administrateur");
  }

  /** Efface l'avis d'issue une fois lu. */
  ackDecision(e: any): void {
    this.changeBusy = e.id;
    this.apiService.ackEventDecision(e.id).subscribe({
      next: ev => this.onChangeSubmitted({ ...ev, lastChangeDecision: null }, 'Avis archivé.'),
      error: err => this.onChangeError(err)
    });
  }

  /** Ouvre le panneau de modification, pré-rempli avec les valeurs actuelles. */
  openEdit(e: any): void {
    this.changeTarget = e;
    this.changeMode = 'edit';
    this.changeForm = {
      title: e.title || '',
      eventDate: this.toLocalInput(e.eventDate),
      totalSeats: e.totalSeats || 0,
      mode: (e.mode || 'PRESENTIEL').toUpperCase(),
      location: e.location || '',
      visioLink: e.visioLink || '',
      description: e.description || '',
      reason: ''
    };
  }

  /** Ouvre le panneau d'annulation : seul le motif est demandé. */
  openCancel(e: any): void {
    this.changeTarget = e;
    this.changeMode = 'cancel';
    this.changeForm = { reason: '' };
  }

  closeChange(): void { this.changeTarget = null; this.changeForm = {}; }

  /** Format attendu par <input type="datetime-local"> : yyyy-MM-ddTHH:mm. */
  private toLocalInput(value: any): string {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  submitChange(): void {
    const target = this.changeTarget;
    if (!target) return;

    if (this.changeMode === 'cancel') {
      const reason = (this.changeForm.reason || '').trim();
      if (!reason) { this.showToast("Indiquez le motif de l'annulation.", 'error'); return; }
      this.changeBusy = target.id;
      this.apiService.requestEventCancel(target.id, reason).subscribe({
        next: ev => this.onChangeSubmitted(ev, 'Annulation soumise à validation.'),
        error: err => this.onChangeError(err)
      });
      return;
    }

    // Modification : on n'envoie que les champs réellement changés.
    const f = this.changeForm;
    const payload: any = {};
    if (f.title !== target.title) payload.title = f.title;
    if (f.location !== (target.location || '')) payload.location = f.location;
    if (f.description !== (target.description || '')) payload.description = f.description;
    if (f.visioLink !== (target.visioLink || '')) payload.visioLink = f.visioLink;
    if (f.mode !== (target.mode || 'PRESENTIEL').toUpperCase()) payload.mode = f.mode;
    if (Number(f.totalSeats) !== Number(target.totalSeats)) payload.totalSeats = Number(f.totalSeats);
    if (f.eventDate && f.eventDate !== this.toLocalInput(target.eventDate)) payload.eventDate = f.eventDate;
    if ((f.reason || '').trim()) payload.reason = f.reason.trim();

    // `reason` seul n'est pas une modification : sans changement réel, rien à soumettre.
    const fields = Object.keys(payload).filter(k => k !== 'reason');
    if (fields.length === 0) { this.showToast('Aucune modification à soumettre.', 'error'); return; }

    this.changeBusy = target.id;
    this.apiService.requestEventUpdate(target.id, payload).subscribe({
      next: ev => this.onChangeSubmitted(ev, 'Modification soumise à validation.'),
      error: err => this.onChangeError(err)
    });
  }

  /** Retire une demande encore en attente. */
  withdrawChange(e: any): void {
    this.changeBusy = e.id;
    this.apiService.withdrawEventChange(e.id).subscribe({
      next: ev => this.onChangeSubmitted(ev, 'Demande retirée.'),
      error: err => this.onChangeError(err)
    });
  }

  private onChangeSubmitted(updated: any, message: string): void {
    this.zone.run(() => {
      this.changeBusy = null;
      this.myEvents = this.myEvents.map(e => (e.id === updated?.id ? { ...e, ...updated } : e));
      this.closeChange();
      this.showToast(message, 'success');
      this.cd.detectChanges();
    });
  }

  private onChangeError(err: any): void {
    this.zone.run(() => {
      this.changeBusy = null;
      this.showToast(err?.error?.error || "La demande n'a pas pu être envoyée.", 'error');
      this.cd.detectChanges();
    });
  }

  eventForm = this.fb.group({
    title: ['', Validators.required],
    type: ['FORMATION', Validators.required],
    category: ['Red Hat', Validators.required],
    mode: ['PRESENTIEL', Validators.required],
    eventDate: ['', Validators.required],
    location: ['', Validators.required],
    visioLink: [''],
    totalSeats: [100, [Validators.required, Validators.min(1)]],
    description: [''],
    // Champs spécifiques par type
    certification: [''],          // Formation
    level: [''],                  // Formation, Workshop
    durationValue: [null as number | null], // Formation (jours) / Workshop (heures)
    prerequisites: [''],          // Formation, Workshop
    speaker: [''],                // Conférence
    latitude: [null as number | null],
    longitude: [null as number | null]
  });

  /** Types de session proposés au formateur. */
  sessionTypes = [
    { value: 'FORMATION',  name: 'Formation',  sub: 'Cursus certifiant (Red Hat, AWS…)' },
    { value: 'WORKSHOP',   name: 'Workshop',   sub: 'Atelier pratique, mains sur le clavier' },
    { value: 'CONFERENCE', name: 'Conférence', sub: 'Présentation / talk thématique' }
  ];

  // Étape de création : 'choose' (choix du type) → 'form' (formulaire dédié)
  createStep: 'choose' | 'form' = 'choose';

  get sessionType(): string { return this.eventForm.get('type')?.value || 'FORMATION'; }
  /** Choix d'un type → ouvre le formulaire dédié. */
  setSessionType(t: string): void {
    this.eventForm.patchValue({ type: t });
    this.createStep = 'form';
    setTimeout(() => this.initCreateMap(), 150);
  }
  backToChoose(): void { this.createStep = 'choose'; }
  /** Libellé du type courant pour les titres du formulaire. */
  get sessionTypeName(): string {
    const s = this.sessionTypes.find(x => x.value === this.sessionType);
    return s ? s.name : 'Session';
  }
  /** Placeholder du titre selon le type (apostrophes gérées ici, pas dans le template). */
  get titlePlaceholder(): string {
    if (this.sessionType === 'CONFERENCE') return "Ex : L'avenir du Cloud souverain";
    if (this.sessionType === 'WORKSHOP') return 'Ex : Atelier Docker & CI/CD';
    return 'Ex : Administration Red Hat (RHCSA)';
  }
  /** Label dynamique du champ catégorie selon le type. */
  get categoryLabel(): string { return this.sessionType === 'FORMATION' ? 'Éditeur / Technologie' : 'Thème'; }
  get durationUnit(): string { return this.sessionType === 'FORMATION' ? 'jours' : 'heures'; }

  // ─── Computed ───
  get upcomingEvents(): any[] {
    return [...this.myEvents]
      .filter(e => new Date(e.eventDate || 0).getTime() > Date.now() - 86400000)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
      .slice(0, 5);
  }

  get filteredEvents(): any[] {
    if (this.evFilter === 'all') return this.myEvents;
    const now = Date.now();
    if (this.evFilter === 'upcoming') return this.myEvents.filter(e => new Date(e.eventDate || 0).getTime() > now);
    return this.myEvents.filter(e => new Date(e.eventDate || 0).getTime() <= now);
  }

  get upcomingCount(): number { return this.myEvents.filter(e => new Date(e.eventDate || 0).getTime() > Date.now()).length; }
  get pastCount(): number { return this.myEvents.length - this.upcomingCount; }

  get totalRegistrations(): number {
    const eventIds = new Set(this.myEvents.map(e => e.id));
    return this.allRegistrations.filter(r => eventIds.has(r.eventId) && r.status === 'CONFIRMED').length;
  }

  get regsThisWeek(): number {
    const eventIds = new Set(this.myEvents.map(e => e.id));
    const weekAgo = Date.now() - 7 * 86400000;
    return this.allRegistrations.filter(r =>
      eventIds.has(r.eventId) &&
      r.status === 'CONFIRMED' &&
      new Date(r.registrationDate || 0).getTime() > weekAgo
    ).length;
  }

  /** Taux de présence : participants ayant validé leur présence (check-in) / inscrits confirmés. */
  get presenceRate(): number {
    const eventIds = new Set(this.myEvents.map(e => e.id));
    const confirmed = this.allRegistrations.filter(r => eventIds.has(r.eventId) && r.status === 'CONFIRMED');
    if (!confirmed.length) return 0;
    const present = confirmed.filter(r => r.checkedIn).length;
    return Math.round((present / confirmed.length) * 100);
  }

  get fillRate(): number {
    const total = this.myEvents.reduce((s, e) => s + (e.totalSeats || 0), 0);
    if (!total) return 0;
    const sold = this.myEvents.reduce((s, e) => s + this.getReservedCount(e), 0);
    return Math.round((sold / total) * 100);
  }

  get myCategoryStats(): { name: string; count: number; pct: number; color: string }[] {
    const counts: Record<string, number> = {};
    this.myEvents.forEach(e => { const c = e.category || 'Autre'; counts[c] = (counts[c] || 0) + 1; });
    const max = Math.max(1, ...Object.values(counts));
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100), color: categoryColor(name) }))
      .sort((a, b) => b.count - a.count);
  }

  // ─── Helpers ───
  categoryGradient = categoryGradient;
  catGradient(cat: string): string { return categoryGradient(cat); }

  isPast(e: any): boolean { return new Date(e.eventDate || 0).getTime() < Date.now(); }

  // Statut de modération (l'organisateur voit si son événement est publié / en attente / refusé)
  modKey(e: any): string {
    const s = (e?.status || '').toUpperCase();
    if (s === 'PENDING') return 'pending';
    if (s === 'REJECTED') return 'rejected';
    return 'approved';
  }
  modLabel(e: any): string {
    const k = this.modKey(e);
    return k === 'pending' ? 'En attente' : k === 'rejected' ? 'Refusé' : 'Publié';
  }
  typeLabel(e: any): string { const t = (e?.type || '').toUpperCase(); return t === 'FORMATION' ? 'Formation' : t === 'WORKSHOP' ? 'Workshop' : t === 'CONFERENCE' ? 'Conférence' : t === 'SEMINAIRE' ? 'Séminaire' : 'Événement'; }
  modeLabel(e: any): string {
    const m = (e?.mode || '').toUpperCase();
    if (m === 'EN_LIGNE') return 'En ligne';
    if (m === 'HYBRIDE') return 'Hybride';
    return 'Présentiel';
  }
  getReservedCount(e: any): number {
    return this.allRegistrations.filter(r => r.eventId === e.id && r.status === 'CONFIRMED').length;
  }
  getPresentCount(e: any): number {
    return this.allRegistrations.filter(r => r.eventId === e.id && r.status === 'CONFIRMED' && r.checkedIn).length;
  }
  getReservedPct(e: any): number {
    if (!e.totalSeats) return 0;
    return Math.round((this.getReservedCount(e) / e.totalSeats) * 100);
  }
  getRemainingPct(e: any): number {
    return Math.max(0, 100 - this.getReservedPct(e));
  }

  // ─── Lifecycle ───
  ngOnInit() {
    // Tab from URL
    this.route.url.subscribe(segs => {
      const last = segs[segs.length - 1]?.path;
      // « Créer un événement » du menu est désormais la seule entrée du parcours :
      // on repart toujours de l'écran de choix du type, jamais d'un formulaire
      // laissé à moitié rempli lors d'une visite précédente.
      if (last === 'create') { this.activeTab = 'create'; this.createStep = 'choose'; }
      this.cd.markForCheck();
    });

    // Load profile then data
    this.keycloak.loadUserProfile().then(p => {
      this.zone.run(() => {
        this.organizerId = p.id || '';
        this.organizerEmail = (p as any).email || '';
        this.organizerName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || (p as any).username || '';
        this.loadAll();
      });
    });
  }

  loadAll() {
    this.loading = true;
    forkJoin({
      events: this.apiService.getAllEvents(),
      regs: this.apiService.getAllRegistrations()
    }).subscribe({
      next: ({ events, regs }) => {
        this.zone.run(() => {
          this.myEvents = events.filter((e: any) => e.organizerId === this.organizerId);
          this.allRegistrations = regs || [];
          this.loading = false;
          this.cd.detectChanges();
        });
      },
      error: () => { this.zone.run(() => { this.loading = false; this.cd.detectChanges(); }); }
    });
  }

  goTab(tab: 'dashboard' | 'events' | 'create') {
    this.activeTab = tab;
    // À l'ouverture de "Créer" : on repart toujours sur l'écran de choix du type
    if (tab === 'create') this.createStep = 'choose';
    const url = tab === 'create' ? '/organizer/create' : '/organizer';
    this.router.navigateByUrl(url, { replaceUrl: true });
    // La carte est initialisée quand le formulaire s'affiche (setSessionType)
  }

  private initCreateMap() {
    const el = document.getElementById('create-map');
    if (!el) return;
    if (this.createMap) { this.createMap.invalidateSize(); return; }

    const c = this.geo.defaultCenter();
    this.createMap = L.map('create-map', { zoomControl: true, attributionControl: false, scrollWheelZoom: true })
      .setView([c.lat, c.lng], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd' }).addTo(this.createMap);
    setTimeout(() => this.createMap?.invalidateSize(), 80);

    // CLIC sur la carte = place le pin + reverse géocodage.
    // On utilise un écouteur DOM NATIF en phase de CAPTURE sur le conteneur :
    //  - le marqueur draggable interceptait le 'click' Leaflet (le clic n'arrivait jamais à la carte) ;
    //  - la phase de capture passe AVANT le marqueur, donc on attrape TOUS les clics ;
    //  - les events Leaflet/DOM tournent hors NgZone → on rentre dans la zone pour rafraîchir le form.
    const container = this.createMap.getContainer();
    container.addEventListener('click', (domEv: MouseEvent) => {
      // Ignorer les clics sur les contrôles (zoom +/-, attribution…)
      const tgt = domEv.target as HTMLElement;
      if (tgt && tgt.closest && tgt.closest('.leaflet-control')) return;
      if (!this.createMap) return;
      const ll = this.createMap.mouseEventToLatLng(domEv);
      this.zone.run(() => {
        this.placePin(ll.lat, ll.lng, true);
        this.cd.detectChanges();
      });
    }, true);

    this.onLocationChange();
  }

  /** Place/déplace le marqueur draggable et stocke lat/lng. */
  private placePin(lat: number, lng: number, reverse: boolean) {
    if (!this.createMap) return;
    const icon = L.divIcon({
      className: 'evt-marker',
      html: '<div class="evt-pin" style="--pin:#e30613"><div class="evt-pin-inner">📍</div></div>',
      iconSize: [40, 48], iconAnchor: [20, 48]
    });
    if (!this.createMarker) {
      this.createMarker = L.marker([lat, lng], { icon, draggable: true }).addTo(this.createMap);
      this.createMarker.on('dragend', (ev: any) => {
        const p = ev.target.getLatLng();
        this.zone.run(() => this.setCoords(p.lat, p.lng, true));
      });
    } else {
      this.createMarker.setLatLng([lat, lng]);
    }
    this.setCoords(lat, lng, reverse);
  }

  private setCoords(lat: number, lng: number, reverse: boolean) {
    // On patche TOUT dans le même patchValue de formulaire (mécanisme qui met bien à jour le badge).
    const patch: any = { latitude: +lat.toFixed(6), longitude: +lng.toFixed(6) };
    if (reverse) {
      // Remplissage IMMÉDIAT : le champ obligatoire ne reste jamais vide après un clic.
      // (sera remplacé par le vrai nom de lieu si Nominatim répond)
      patch.location = `Position ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    this.eventForm.patchValue(patch);
    if (reverse) {
      const ctrl = this.eventForm.get('location');
      ctrl?.markAsTouched();
      ctrl?.markAsDirty();
      this.cd.detectChanges();
      this.reverseGeocode(lat, lng);
    }
  }

  /** Reverse géocodage Nominatim (gratuit) pour remplir le champ Lieu depuis le clic. */
  private reverseGeocode(lat: number, lng: number) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&accept-language=fr`)
      .then(r => r.json())
      .then(data => {
        this.zone.run(() => {
          const a = data.address || {};
          const place = a.city || a.town || a.village || a.county || data.display_name?.split(',')[0];
          if (place) {
            // Même mécanisme : patchValue de formulaire (pas une référence de contrôle isolée).
            this.eventForm.patchValue({ location: place });
            this.eventForm.get('location')?.markAsTouched();
            this.cd.detectChanges();
          }
        });
      }).catch(() => {
        // Nominatim indisponible : on garde le repli "Position lat, lng" déjà posé.
      });
  }

  onLocationChange() {
    if (!this.createMap) return;
    const loc = this.eventForm.get('location')?.value || '';
    const pos = this.geo.resolve(loc);
    this.placePin(pos.lat, pos.lng, false);
    this.createMap.setView([pos.lat, pos.lng], loc ? 12 : 6, { animate: true });
  }

  createEvent() {
    // Filet de sécurité : si un pin a été posé (coords présentes) mais que le champ Lieu
    // est resté vide (Nominatim KO, etc.), on le remplit avec les coordonnées avant validation.
    const locCtrl = this.eventForm.get('location');
    const lat = this.eventForm.get('latitude')?.value;
    const lng = this.eventForm.get('longitude')?.value;
    if ((!locCtrl?.value || !locCtrl.value.toString().trim()) && lat != null && lng != null) {
      locCtrl?.patchValue(`Position ${(+lat).toFixed(4)}, ${(+lng).toFixed(4)}`);
    }
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      this.showToast('Veuillez remplir les champs obligatoires', 'error');
      return;
    }
    this.creating = true;
    const v: any = { ...this.eventForm.value };
    // Compose la durée libellée ("3 jours" / "4 heures") à partir du nombre + type
    if (v.durationValue) v.duration = `${v.durationValue} ${this.durationUnit}`;
    delete v.durationValue;
    const payload = { ...v, organizerId: this.organizerId, organizerEmail: this.organizerEmail, organizerName: this.organizerName };
    this.apiService.createEvent(payload).subscribe({
      next: () => {
        this.zone.run(() => {
          this.creating = false;
          this.notifs.push('info', 'event', 'Session soumise', `${payload.title} — en attente de validation`, undefined, { path: '/organizer' });
          this.eventForm.reset({ type: 'FORMATION', category: 'Red Hat', mode: 'PRESENTIEL', totalSeats: 100 });
          this.showToast('Session soumise ! En attente de validation par un administrateur.', 'success');
          this.loadAll();
          this.goTab('events');
          this.cd.detectChanges();
        });
      },
      error: (err) => {
        this.zone.run(() => {
          this.creating = false;
          const msg = err?.status === 403 ? 'Accès refusé' : err?.status === 401 ? 'Session expirée' : 'Erreur lors de la publication';
          this.showToast(msg, 'error');
          this.cd.detectChanges();
        });
      }
    });
  }

  deleteEvent(id: string) {
    this.apiService.deleteEvent(id).subscribe({
      next: () => {
        this.zone.run(() => {
          this.deleteConfirm = null;
          this.showToast('Événement supprimé', 'success');
          this.loadAll();
        });
      },
      error: () => this.zone.run(() => this.showToast('Erreur lors de la suppression', 'error'))
    });
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toast = { message, type };
    setTimeout(() => this.zone.run(() => { this.toast = null; this.cd.detectChanges(); }), 3500);
  }
}
