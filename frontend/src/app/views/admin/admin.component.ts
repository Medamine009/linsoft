import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { categoryGradient } from '../../shared/categories';
import { certificateLabel, certificateTone } from '../../shared/participation';
import { NotifsService } from '../../services/notifs.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="adm" [attr.data-tab]="activeTab">

      <!-- ─── TOP BAR ─── -->
      <header class="adm-topbar">
        <div class="adm-topbar-l">
          <div class="adm-crumb">
            <span class="adm-crumb-org">Admin</span>
            <svg class="adm-crumb-sep" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            <span class="adm-crumb-page">{{ crumbLabel() }}</span>
          </div>
        </div>
      </header>

      <!-- ─── HEADER ─── -->
      <div class="adm-header">
        <div *ngIf="activeTab === 'overview'">
          <h1 class="adm-h1">Tableau de bord</h1>
          <p class="adm-sub">Vue d'ensemble de l'activité de la plateforme.</p>
        </div>
        <div *ngIf="activeTab === 'review'">
          <h1 class="adm-h1">Modération &amp; validations</h1>
          <p class="adm-sub">Approuvez les sessions et validez les demandes d'inscription au même endroit.</p>
        </div>
        <div *ngIf="activeTab === 'certificates'">
          <h1 class="adm-h1">Gestion des certificats</h1>
          <p class="adm-sub">Sessions terminées : délivrez les certificats de participation ou différez-les.</p>
        </div>
        <div *ngIf="activeTab === 'communication'">
          <h1 class="adm-h1">Communication</h1>
          <p class="adm-sub">Envoyez un message par email aux participants.</p>
        </div>
        <div *ngIf="activeTab === 'stats'">
          <h1 class="adm-h1">Rapports &amp; statistiques</h1>
          <p class="adm-sub">Indicateurs et export des données de la plateforme.</p>
        </div>
      </div>

      <!-- ─── ACTIONS RAPIDES (tableau de bord uniquement) ─── -->
      <div class="quick-actions" *ngIf="activeTab === 'overview'">
        <button class="qa-btn" (click)="router.navigate(['/events'])">
          <svg viewBox="0 0 16 16" fill="none"><rect x="2.5" y="3" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M2.5 6h11M6 1.5v3M10 1.5v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Événements
        </button>
        <button class="qa-btn" (click)="router.navigate(['/users'])">
          <svg viewBox="0 0 16 16" fill="none"><circle cx="5.5" cy="6" r="2.5" stroke="currentColor" stroke-width="1.5"/><circle cx="11" cy="6" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M1.5 13c0-2.2 1.8-4 4-4s4 1.8 4 4M9 13c0-1.8 1.3-3 3-3s2.5 1.2 2.5 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          Utilisateurs
        </button>
        <button class="qa-btn qa-ghost" (click)="loadStats()" [class.spinning]="loadingUsers || loadingEvents">
          <svg viewBox="0 0 16 16" fill="none"><path d="M14 8a6 6 0 1 1-2-4.5M14 2v3h-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Actualiser
        </button>
      </div>

      <!-- ─── METRICS (tableau de bord uniquement) ─── -->
      <div class="adm-metrics" *ngIf="activeTab === 'overview'">
        <div class="metric-card">
          <span class="metric-label">Utilisateurs</span>
          <div class="metric-value">{{ usersCount }}</div>
          <div class="metric-foot">comptes enregistrés</div>
        </div>
        <div class="metric-card">
          <span class="metric-label">Événements &amp; formations</span>
          <div class="metric-value">{{ eventsCount }}</div>
          <div class="metric-foot">{{ approvedCount }} publiés</div>
        </div>
        <div class="metric-card">
          <span class="metric-label">Inscriptions</span>
          <div class="metric-value">{{ registrationsCount }}</div>
          <div class="metric-foot">cumulées</div>
        </div>
        <div class="metric-card" [class.metric-card-alert]="pendingCount > 0">
          <span class="metric-label">En attente de modération</span>
          <div class="metric-value">{{ pendingCount }}</div>
          <div class="metric-foot">{{ pendingCount > 0 ? 'à traiter' : 'rien à valider' }}</div>
        </div>
        <div class="metric-card metric-card-clickable" [class.metric-card-alert]="pendingCerts.length > 0"
             (click)="router.navigate(['/admin'], { queryParams: { tab: 'certificates' } })">
          <span class="metric-label">Certificats à délivrer</span>
          <div class="metric-value">{{ pendingCerts.length }}</div>
          <div class="metric-foot">{{ pendingCerts.length > 0 ? 'sessions terminées à traiter' : 'aucun certificat en attente' }}</div>
        </div>
      </div>

      <!-- ─── OVERVIEW ─── -->
      <div *ngIf="activeTab === 'overview'" class="adm-content">
        <div class="adm-grid-2">
          <!-- Recent users -->
          <section class="panel">
            <div class="panel-head">
              <h3 class="panel-title">Derniers utilisateurs</h3>
              <button class="link-btn" (click)="router.navigate(['/users'])">Tout voir →</button>
            </div>
            <div class="panel-body panel-body-flush">
              <div class="rec-row" *ngFor="let u of recentUsers">
                <div class="rec-avatar" [style.background]="avatarBg(u)">{{ initials(u) }}</div>
                <div class="rec-info">
                  <div class="rec-name">{{ u.firstName }} {{ u.lastName }}</div>
                  <div class="rec-meta">{{ u.email }}</div>
                </div>
                <span class="tag tag-{{ (u.role || 'user') | lowercase }}">{{ u.role || 'USER' }}</span>
              </div>
              <div *ngIf="users.length === 0" class="panel-empty">Aucun utilisateur</div>
            </div>
          </section>

          <!-- Recent events -->
          <section class="panel">
            <div class="panel-head">
              <h3 class="panel-title">Derniers événements</h3>
              <button class="link-btn" (click)="router.navigate(['/events'])">Tout voir →</button>
            </div>
            <div class="panel-body panel-body-flush">
              <div class="rec-row" *ngFor="let e of events.slice(0, 5)">
                <div class="rec-thumb" [style.background]="catGradient(e.category)"></div>
                <div class="rec-info">
                  <div class="rec-name">{{ e.title }}</div>
                  <div class="rec-meta">{{ e.eventDate | date:'dd MMM yyyy' }} · {{ e.location || '—' }}</div>
                </div>
                <span class="tag tag-{{ (e.category || 'event') | lowercase }}">{{ e.category || '—' }}</span>
              </div>
              <div *ngIf="events.length === 0" class="panel-empty">Aucun événement</div>
            </div>
          </section>
        </div>

        <!-- Prochaines sessions (données réelles) -->
        <section class="panel">
          <div class="panel-head">
            <h3 class="panel-title">Prochaines sessions <span class="panel-count">{{ upcomingEvents.length }}</span></h3>
            <button class="link-btn" (click)="router.navigate(['/admin'], { queryParams: { tab: 'review' } })" *ngIf="pendingCount > 0">{{ pendingCount }} à modérer →</button>
          </div>
          <div class="panel-body panel-body-flush">
            <div class="up-row" *ngFor="let e of upcomingEvents.slice(0, 6)">
              <div class="up-date">
                <span class="up-d">{{ e.eventDate | date:'dd' }}</span>
                <span class="up-m">{{ e.eventDate | date:'MMM' }}</span>
              </div>
              <div class="up-info">
                <div class="up-title">{{ e.title }}</div>
                <div class="up-meta">
                  <span class="tag tag-{{ (e.category || 'event') | lowercase }}">{{ e.category || '—' }}</span>
                  <span>{{ modeLabel(e) }}</span>
                  <span>· {{ e.location || 'En ligne' }}</span>
                </div>
              </div>
              <div class="up-stat">
                <span class="up-stat-v">{{ countInscrits(e) }}</span>
                <span class="up-stat-l">inscrits</span>
              </div>
              <span class="status-pill status-{{ statusKey(e) }}">{{ statusLabel(e) }}</span>
            </div>
            <div *ngIf="upcomingEvents.length === 0" class="panel-empty">Aucune session à venir</div>
          </div>
        </section>
      </div>


      <!-- ─── MODÉRATION & VALIDATIONS (fusionnées) ─── -->
      <div *ngIf="activeTab === 'review'" class="adm-content">

        <!-- Barre de navigation interne -->
        <div class="review-nav">
          <button class="review-navbtn" [class.active]="reviewTab==='moderation'" (click)="reviewTab='moderation'">
            <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5l5.5 2.2v3.6c0 3.2-2.3 5.4-5.5 6.7-3.2-1.3-5.5-3.5-5.5-6.7V3.7L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.8 8l1.6 1.6L10.4 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Modération des sessions
            <span class="review-badge" *ngIf="pendingEvents.length">{{ pendingEvents.length }}</span>
          </button>
          <button class="review-navbtn" [class.active]="reviewTab==='validations'" (click)="reviewTab='validations'; loadPending()">
            <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5.5 1.5V4M10.5 1.5V4M6 10l1.4 1.4L10.5 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Validation des inscriptions
            <span class="review-badge" *ngIf="pendingRegs.length">{{ pendingRegs.length }}</span>
          </button>
          <button class="review-navbtn" [class.active]="reviewTab==='changes'" (click)="reviewTab='changes'; loadChanges()">
            <svg viewBox="0 0 16 16" fill="none"><path d="M11 2.2L3.4 9.8 2.6 13.4l3.6-.8 7.6-7.6-2.8-2.8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
            Modifications &amp; annulations
            <span class="review-badge" *ngIf="pendingChanges.length">{{ pendingChanges.length }}</span>
          </button>
        </div>

        <!-- Contenu : demandes des organisateurs sur des sessions publiées -->
        <section class="panel" *ngIf="reviewTab==='changes'">
          <div class="panel-head">
            <h3 class="panel-title">Demandes des formateurs <span class="panel-count">{{ pendingChanges.length }}</span></h3>
            <span class="panel-meta">L'approbation applique le changement et prévient tous les inscrits</span>
          </div>

          <div *ngIf="loadingChanges" class="panel-loading">
            <div class="skel-row" *ngFor="let _ of [1,2]"></div>
          </div>

          <div *ngIf="!loadingChanges && pendingChanges.length === 0" class="panel-empty-state">
            <div class="empty-glyph">
              <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="1.5"/><path d="M16 24l5 5 11-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="empty-title">Aucune demande en attente</div>
            <div class="empty-desc">Les modifications et annulations demandées par les formateurs apparaîtront ici.</div>
          </div>

          <div *ngIf="pendingChanges.length > 0" class="mod-list">
            <div class="mod-card" *ngFor="let e of pendingChanges">
              <div class="mod-thumb" [style.background]="catGradient(e.category)"></div>
              <div class="mod-info">
                <div class="chg-kind" [class.chg-cancel]="e.pendingChange?.type === 'CANCEL'">
                  {{ e.pendingChange?.type === 'CANCEL' ? 'Demande d’annulation' : 'Demande de modification' }}
                </div>
                <div class="mod-title">{{ e.title }}</div>
                <div class="mod-meta">
                  <span>📅 {{ e.eventDate | date:'dd MMM yyyy · HH:mm' }}</span>
                  <span>📍 {{ e.location || '—' }}</span>
                  <span *ngIf="e.organizerName">👤 {{ e.organizerName }}</span>
                </div>

                <!-- Annulation : le motif est l'essentiel de la décision -->
                <div class="chg-reason" *ngIf="e.pendingChange?.type === 'CANCEL'">
                  <span class="chg-reason-l">Motif invoqué</span>
                  {{ e.pendingChange?.reason }}
                </div>

                <!-- Modification : ce qui change, ligne à ligne -->
                <div class="chg-diff" *ngIf="e.pendingChange?.type !== 'CANCEL'">
                  <div class="chg-row" *ngFor="let d of changeDiff(e)">
                    <span class="chg-field">{{ d.label }}</span>
                    <span class="chg-old">{{ d.before }}</span>
                    <span class="chg-arrow">→</span>
                    <span class="chg-new">{{ d.after }}</span>
                  </div>
                  <div class="chg-row chg-empty" *ngIf="changeDiff(e).length === 0">
                    Aucun écart détectable sur les champs suivis.
                  </div>
                  <div class="chg-note" *ngIf="e.pendingChange?.reason">
                    Précision du formateur : {{ e.pendingChange?.reason }}
                  </div>
                </div>
              </div>

              <div class="mod-actions">
                <button class="mod-btn mod-approve" (click)="approveChange(e)" [disabled]="changeBusy === e.id">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Approuver
                </button>
                <button class="mod-btn mod-reject" (click)="rejectChange(e)" [disabled]="changeBusy === e.id">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  Refuser
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Contenu : modération des sessions -->
        <section class="panel" *ngIf="reviewTab==='moderation'">
          <div class="panel-head">
            <h3 class="panel-title">En attente de validation <span class="panel-count">{{ pendingEvents.length }}</span></h3>
            <span class="panel-meta">Approuvez ou refusez les événements avant publication</span>
          </div>

          <div *ngIf="loadingEvents" class="panel-loading">
            <div class="skel-row" *ngFor="let _ of [1,2,3]"></div>
          </div>

          <div *ngIf="!loadingEvents && pendingEvents.length === 0" class="panel-empty-state">
            <div class="empty-glyph">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="1.5"/>
                <path d="M16 24l5 5 11-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="empty-title">Tout est à jour ✨</div>
            <div class="empty-desc">Aucun événement en attente de modération.</div>
          </div>

          <div *ngIf="!loadingEvents && pendingEvents.length > 0" class="mod-list">
            <div class="mod-card" *ngFor="let e of pendingEvents">
              <div class="mod-thumb" [style.background]="catGradient(e.category)"></div>
              <div class="mod-info">
                <div class="mod-title">{{ e.title }}</div>
                <div class="mod-meta">
                  <span class="tag tag-{{ (e.category || 'event') | lowercase }}">{{ e.category || '—' }}</span>
                  <span>📅 {{ e.eventDate | date:'dd MMM yyyy' }}</span>
                  <span>📍 {{ e.location || '—' }}</span>
                </div>
                <div class="mod-desc">{{ e.description || 'Aucune description fournie.' }}</div>
                <div class="mod-pills">
                  <span class="mod-pill">{{ e.totalSeats || 0 }} places</span>
                  <span class="mod-pill">{{ typeLabel(e) }}</span>
                </div>
              </div>
              <div class="mod-actions">
                <button class="mod-btn mod-approve" (click)="moderate(e.id, 'APPROVED')" [disabled]="moderating === e.id">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Approuver
                </button>
                <button class="mod-btn mod-reject" (click)="moderate(e.id, 'REJECTED')" [disabled]="moderating === e.id">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                  Refuser
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Contenu : validation des inscriptions -->
        <section class="panel" *ngIf="reviewTab==='validations'">
          <!-- Onglets de statut -->
          <div class="val-tabs">
            <button class="val-tab" [class.active]="valTab==='pending'" (click)="valTab='pending'">
              En attente <span class="val-count val-count-alert" *ngIf="pendingRegs.length">{{ pendingRegs.length }}</span>
            </button>
            <button class="val-tab" [class.active]="valTab==='approved'" (click)="valTab='approved'">
              Approuvées <span class="val-count">{{ approvedCountReg }}</span>
            </button>
            <button class="val-tab" [class.active]="valTab==='rejected'" (click)="valTab='rejected'">
              Refusées <span class="val-count">{{ rejectedCountReg }}</span>
            </button>
          </div>

          <div *ngIf="loadingPending && valTab==='pending'" class="panel-loading">
            <div class="skel-row" *ngFor="let _ of [1,2,3]"></div>
          </div>

          <div *ngIf="!(loadingPending && valTab==='pending') && valRegs.length === 0" class="panel-empty-state">
            <div class="empty-glyph">
              <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="1.5"/><path d="M16 24l5 5 11-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="empty-title">{{ valTab==='pending' ? 'Aucune demande en attente' : valTab==='approved' ? 'Aucune inscription approuvée' : 'Aucune demande refusée' }}</div>
            <div class="empty-desc">Les inscriptions apparaîtront ici selon leur statut.</div>
          </div>

          <div *ngIf="valRegs.length > 0" class="mod-list">
            <div class="mod-card" *ngFor="let r of valRegs">
              <div class="reg-ava">{{ (r.attendeeName || '?').charAt(0).toUpperCase() }}</div>
              <div class="mod-info">
                <div class="mod-title">{{ r.attendeeName || 'Participant' }}</div>
                <div class="mod-meta">
                  <span><svg class="mm-ico" viewBox="0 0 16 16" fill="none"><path d="M8 2L1 5l7 3 7-3-7-3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M4 6.5V10c0 1 1.8 1.8 4 1.8s4-.8 4-1.8V6.5" stroke="currentColor" stroke-width="1.4"/></svg>{{ r.eventTitle || 'Session' }}</span>
                  <span *ngIf="r.eventDateStr"><svg class="mm-ico" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5 1.5V4M11 1.5V4" stroke="currentColor" stroke-width="1.4"/></svg>{{ r.eventDateStr | date:'dd MMM yyyy' }}</span>
                  <span *ngIf="r.eventLocation"><svg class="mm-ico" viewBox="0 0 16 16" fill="none"><path d="M8 14s5-4.5 5-8A5 5 0 0 0 3 6c0 3.5 5 8 5 8z" stroke="currentColor" stroke-width="1.4"/><circle cx="8" cy="6" r="1.8" stroke="currentColor" stroke-width="1.4"/></svg>{{ r.eventLocation }}</span>
                </div>
                <div class="mod-pills">
                  <span class="mod-pill">Demande du {{ r.registrationDate | date:'dd/MM/yyyy' }}</span>
                </div>
              </div>
              <div class="mod-actions">
                <ng-container *ngIf="valTab==='pending'">
                  <button class="mod-btn mod-approve" (click)="approveReg(r.id)" [disabled]="regBusy === r.id">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    Accepter
                  </button>
                  <button class="mod-btn mod-reject" (click)="rejectReg(r.id)" [disabled]="regBusy === r.id">
                    <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                    Refuser
                  </button>
                </ng-container>
                <span *ngIf="valTab==='approved'" class="val-badge val-ok">Approuvée</span>
                <span *ngIf="valTab==='rejected'" class="val-badge val-ko">Refusée</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <!-- ─── CERTIFICATS ─── -->
      <div *ngIf="activeTab === 'certificates'" class="adm-content">

        <!-- Tâche en attente : une session terminée sans certificat délivré -->
        <div class="cert-task" *ngIf="!loadingCerts && pendingCerts.length > 0">
          <div class="cert-task-ico">
            <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="7.5" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M7.2 11.4L6 18l4-2 4 2-1.2-6.6" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </div>
          <div class="cert-task-txt">
            <div class="cert-task-title">
              {{ certificateGroups.length }} session(s) terminée(s) — {{ pendingCerts.length }} certificat(s) à traiter
            </div>
            <div class="cert-task-desc">
              Les participants voient « certificat en préparation » tant que vous n'avez pas tranché.
            </div>
          </div>
          <button class="mod-btn mod-approve" (click)="loadCertificates()" [disabled]="loadingCerts">Actualiser</button>
        </div>

        <div *ngIf="loadingCerts" class="panel">
          <div class="panel-loading"><div class="skel-row" *ngFor="let _ of [1,2,3]"></div></div>
        </div>

        <div *ngIf="!loadingCerts && certificateGroups.length === 0" class="panel">
          <div class="panel-empty-state">
            <div class="empty-glyph">
              <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="18" stroke="currentColor" stroke-width="1.5"/><path d="M16 24l5 5 11-11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <div class="empty-title">Aucun certificat en attente</div>
            <div class="empty-desc">Les certificats apparaissent ici dès qu'une session se termine.</div>
          </div>
        </div>

        <!-- Une session terminée = un lot de certificats -->
        <section class="panel cert-group" *ngFor="let g of certificateGroups">
          <div class="panel-head">
            <div class="cert-group-head">
              <h3 class="panel-title">{{ g.eventTitle }} <span class="panel-count">{{ g.items.length }}</span></h3>
              <span class="panel-meta">
                Terminée le {{ g.completedAt | date:'dd MMM yyyy' }} ·
                {{ g.items.length }} participant(s) en attente de certificat
              </span>
            </div>
            <button class="mod-btn mod-approve" (click)="sendAllCertificates(g)" [disabled]="certBusy === g.eventId">
              <svg viewBox="0 0 16 16" fill="none"><path d="M14.5 1.8L7 9.3M14.5 1.8l-4.7 12.4-2.8-4.9-4.9-2.8L14.5 1.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
              {{ certBusy === g.eventId ? 'Envoi…' : 'Tout envoyer' }}
            </button>
          </div>

          <div class="mod-list">
            <div class="mod-card" *ngFor="let r of g.items">
              <div class="reg-ava">{{ (r.attendeeName || '?').charAt(0).toUpperCase() }}</div>
              <div class="mod-info">
                <div class="mod-title">{{ r.attendeeName || 'Participant' }}</div>
                <div class="mod-meta">
                  <span *ngIf="r.eventDateStr">
                    <svg class="mm-ico" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M2 6.5h12M5 1.5V4M11 1.5V4" stroke="currentColor" stroke-width="1.4"/></svg>
                    {{ r.eventDateStr | date:'dd MMM yyyy' }}
                  </span>
                  <span [class.cert-absent]="!r.checkedIn">
                    <svg class="mm-ico" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5.2 8.2l1.9 1.9 3.7-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    {{ r.checkedIn ? 'Présence validée' : 'Présence non validée' }}
                  </span>
                  <span>Réf. #{{ shortId(r.id) }}</span>
                </div>
                <div class="mod-pills">
                  <span class="badge badge-{{ certificateToneOf(r) }}">{{ certificateLabelOf(r) }}</span>
                  <span class="mod-pill" *ngIf="r.certificateHandledBy">Différé par {{ r.certificateHandledBy }}</span>
                </div>
              </div>
              <div class="mod-actions">
                <button class="mod-btn mod-approve" (click)="sendCertificate(r)" [disabled]="certBusy === r.id">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  Envoyer le certificat
                </button>
                <button class="mod-btn mod-hold" (click)="holdCertificate(r)"
                        [disabled]="certBusy === r.id || r.certificateStatus === 'PENDING_APPROVAL'">
                  <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.8V8l2.1 1.3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  {{ r.certificateStatus === 'PENDING_APPROVAL' ? 'Déjà en attente' : 'Garder en attente' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Historique : ce qui a déjà été délivré -->
        <section class="panel" *ngIf="sentCertificates.length > 0">
          <div class="panel-head">
            <h3 class="panel-title">Certificats délivrés <span class="panel-count">{{ sentCertificates.length }}</span></h3>
            <span class="panel-meta">Téléchargeables par les participants</span>
          </div>
          <div class="panel-body panel-body-flush">
            <div class="rec-row" *ngFor="let r of sentCertificates.slice(0, 10)">
              <div class="reg-ava reg-ava-sm">{{ (r.attendeeName || '?').charAt(0).toUpperCase() }}</div>
              <div class="rec-info">
                <div class="rec-name">{{ r.attendeeName || 'Participant' }}</div>
                <div class="rec-meta">{{ r.eventTitle || 'Session' }}</div>
              </div>
              <span class="badge badge-success">Envoyé {{ r.certificateSentAt | date:'dd/MM/yyyy' }}</span>
            </div>
          </div>
        </section>
      </div>

      <!-- ─── COMMUNICATION ─── -->
      <div *ngIf="activeTab === 'communication'" class="adm-content">
        <div class="com-layout">

          <!-- Colonne formulaire -->
          <section class="panel com-form-panel">
            <div class="panel-head">
              <h3 class="panel-title">Nouveau message</h3>
              <span class="panel-meta">Diffusion par email aux participants</span>
            </div>

            <div class="com-form">
              <label class="com-label">Destinataires</label>
              <div class="com-audience">
                <button class="aud-card" [class.active]="comAudience === 'all'" (click)="setAudience('all')">
                  <svg viewBox="0 0 20 20" fill="none"><circle cx="7" cy="7.5" r="3" stroke="currentColor" stroke-width="1.5"/><circle cx="14" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 16c0-2.8 2.2-5 5-5s5 2.2 5 5M12 16c0-2.2 1.6-3.8 3.8-3.8S18.5 13.8 18.5 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  <div class="aud-card-t">Tous les participants</div>
                  <div class="aud-card-d">Diffusion générale</div>
                </button>
                <button class="aud-card" [class.active]="comAudience === 'event'" (click)="setAudience('event')">
                  <svg viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M3 8h14M7 2v3M13 2v3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                  <div class="aud-card-t">Une session</div>
                  <div class="aud-card-d">Participants ciblés</div>
                </button>
                <button class="aud-card" [class.active]="comAudience === 'selection'" (click)="setAudience('selection')">
                  <svg viewBox="0 0 20 20" fill="none"><path d="M3 6h9M3 10h9M3 14h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13.5 13.5l2 2 3.5-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <div class="aud-card-t">Sélection</div>
                  <div class="aud-card-d">1 ou plusieurs personnes</div>
                </button>
              </div>

              <select *ngIf="comAudience === 'event'" class="com-input" [(ngModel)]="comEventId">
                <option value="">— Choisir une session —</option>
                <option *ngFor="let e of events" [value]="e.id">{{ e.title }}</option>
              </select>

              <!-- ─── Sélection manuelle des destinataires (1, 2, 3… participants) ─── -->
              <div *ngIf="comAudience === 'selection'" class="rec-picker">
                <div class="rec-picker-head">
                  <input class="com-input rec-search" [(ngModel)]="comSearch"
                         placeholder="Rechercher un participant (nom ou email)…">
                  <div class="rec-picker-actions">
                    <button class="rec-linkbtn" (click)="selectAllVisible()"
                            [disabled]="filteredParticipants.length === 0">Tout sélectionner</button>
                    <button class="rec-linkbtn" (click)="clearSelection()"
                            [disabled]="comSelectedCount === 0">Effacer</button>
                  </div>
                </div>

                <div class="rec-chips" *ngIf="comSelectedCount > 0">
                  <span class="rec-chip" *ngFor="let u of selectedParticipants">
                    {{ fullName(u) }}
                    <button class="rec-chip-x" (click)="toggleRecipient(u)" title="Retirer">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>
                    </button>
                  </span>
                </div>

                <div class="rec-list">
                  <label *ngFor="let u of filteredParticipants" class="rec-row" [class.checked]="isSelected(u)">
                    <input type="checkbox" [checked]="isSelected(u)" (change)="toggleRecipient(u)">
                    <span class="rec-ava-sm" [style.background]="avatarBg(u)">{{ initials(u) }}</span>
                    <span class="rec-meta">
                      <span class="rec-name">{{ fullName(u) }}</span>
                      <span class="rec-mail">{{ u.email }}</span>
                    </span>
                  </label>
                  <div *ngIf="filteredParticipants.length === 0" class="rec-empty">
                    {{ comSearch ? 'Aucun participant ne correspond à cette recherche.' : 'Aucun participant enregistré.' }}
                  </div>
                </div>
              </div>

              <label class="com-label">Objet</label>
              <input class="com-input" [(ngModel)]="comSubject" maxlength="120" placeholder="Ex : Rappel — session de demain">

              <label class="com-label">Message <span class="com-charcount">{{ comMessage.length }} / 2000</span></label>
              <textarea class="com-input com-textarea" [(ngModel)]="comMessage" rows="8" maxlength="2000" placeholder="Votre message aux participants…"></textarea>

              <!-- Erreur d'envoi : message clair, jamais un détail technique brut -->
              <div class="com-alert" *ngIf="comError">
                <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.6" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6v4M8 10.8v.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
                <span>{{ comError }}</span>
              </div>

              <div class="com-actions">
                <button class="com-send" (click)="sendBroadcast()" [disabled]="comSending || comRecipientCount === 0">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2l-4.5 12-2.5-5-5-2.5L14 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  {{ comSending ? 'Envoi…' : 'Envoyer le message' }}
                </button>
                <span class="com-hint" *ngIf="comRecipientCount === 0">{{ comEmptyHint }}</span>
              </div>
            </div>
          </section>

          <!-- Colonne aperçu + destinataires -->
          <aside class="com-aside">
            <div class="com-reccard">
              <div class="com-reccard-num">{{ comRecipientCount }}</div>
              <div class="com-reccard-lbl">destinataire(s)</div>
              <div class="com-reccard-sub">{{ comAudienceLabel }}</div>
            </div>

            <div class="com-tips">
              <div class="com-tips-t">
                <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.2v4M8 5.2v.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                Bon à savoir
              </div>
              <ul class="com-tips-list">
                <li>Le message est envoyé par email à chaque destinataire.</li>
                <li>Il apparaît aussi dans leur boîte de réception sur la plateforme.</li>
                <li>Choisissez « Une session » pour ne cibler que ses participants.</li>
                <li>« Sélection » permet de cocher précisément une ou plusieurs personnes.</li>
              </ul>
            </div>
          </aside>

        </div>
      </div>

      <!-- ─── STATISTIQUES ─── -->
      <div *ngIf="activeTab === 'stats'" class="adm-content">
        <!-- Barre d'export -->
        <div class="export-bar">
          <span class="export-label">Exporter les données</span>
          <div class="export-btns">
            <button class="exp-btn" (click)="exportCsv('users')">Utilisateurs (CSV)</button>
            <button class="exp-btn" (click)="exportCsv('events')">Événements (CSV)</button>
            <button class="exp-btn" (click)="exportCsv('registrations')">Inscriptions (CSV)</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="stats-kpis">
          <div class="kpi">
            <div class="kpi-label">Taux de présence</div>
            <div class="kpi-val">{{ presenceRate }}%</div>
            <div class="kpi-foot">présences validées au check-in</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Taux de remplissage</div>
            <div class="kpi-val">{{ occupancyRate }}%</div>
            <div class="kpi-bar"><span [style.width.%]="occupancyRate"></span></div>
          </div>
          <div class="kpi">
            <div class="kpi-label">Inscriptions / événement</div>
            <div class="kpi-val">{{ avgRegPerEvent }}</div>
            <div class="kpi-foot">moyenne</div>
          </div>
          <div class="kpi">
            <div class="kpi-label">En attente de modération</div>
            <div class="kpi-val">{{ pendingCount }}</div>
            <div class="kpi-foot">{{ approvedCount }} approuvés · {{ rejectedCount }} refusés</div>
          </div>
        </div>

        <div class="adm-grid-2">
          <!-- Statut des événements -->
          <section class="panel">
            <div class="panel-head"><h3 class="panel-title">Événements par statut</h3></div>
            <div class="panel-body">
              <div class="bar-row" *ngFor="let s of statusBreakdown()">
                <div class="bar-label">{{ s.label }}</div>
                <div class="bar-track"><span class="bar-fill" [style.width.%]="s.pct" [style.background]="s.color"></span></div>
                <div class="bar-value">{{ s.count }}</div>
              </div>
            </div>
          </section>

          <!-- Catégories -->
          <section class="panel">
            <div class="panel-head"><h3 class="panel-title">Événements par catégorie</h3></div>
            <div class="panel-body">
              <div *ngIf="categoryBreakdown().length === 0" class="panel-empty">Aucune donnée</div>
              <div class="bar-row" *ngFor="let c of categoryBreakdown()">
                <div class="bar-label">{{ c.label }}</div>
                <div class="bar-track"><span class="bar-fill" [style.width.%]="c.pct" [style.background]="c.color"></span></div>
                <div class="bar-value">{{ c.count }}</div>
              </div>
            </div>
          </section>
        </div>

        <div class="adm-grid-2">
          <!-- Utilisateurs par rôle -->
          <section class="panel">
            <div class="panel-head"><h3 class="panel-title">Utilisateurs par rôle</h3></div>
            <div class="panel-body">
              <div class="bar-row" *ngFor="let r of usersByRole()">
                <div class="bar-label">{{ r.label }}</div>
                <div class="bar-track"><span class="bar-fill" [style.width.%]="r.pct" [style.background]="r.color"></span></div>
                <div class="bar-value">{{ r.count }}</div>
              </div>
            </div>
          </section>

          <!-- Top événements -->
          <section class="panel">
            <div class="panel-head"><h3 class="panel-title">Top événements (inscriptions)</h3></div>
            <div class="panel-body panel-body-flush">
              <div *ngIf="topEvents().length === 0" class="panel-empty">Aucune inscription enregistrée</div>
              <div class="rec-row" *ngFor="let t of topEvents(); let i = index">
                <div class="rec-rank">{{ i + 1 }}</div>
                <div class="rec-info">
                  <div class="rec-name">{{ t.title }}</div>
                  <div class="rec-meta">{{ t.count }} inscription(s)</div>
                </div>
                <div class="rec-bar"><span [style.width.%]="t.pct"></span></div>
              </div>
            </div>
          </section>
        </div>

        <!-- Analyse IA des avis (sentiment) -->
        <section class="panel" style="margin-top:20px;">
          <div class="panel-head">
            <h3 class="panel-title">Analyse IA des avis <span class="panel-count">sentiment</span></h3>
            <span class="panel-meta">Synthèse générée par l'assistant IA</span>
          </div>
          <div class="panel-body">
            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
              <select [(ngModel)]="aiEventId"
                      style="padding:8px 12px;border:1px solid var(--border-default);border-radius:8px;background:var(--surface-base);color:var(--text-primary);font-size:13px;min-width:260px;font-family:inherit;">
                <option value="">Choisir une session…</option>
                <option *ngFor="let e of events" [value]="e.id">{{ e.title }}</option>
              </select>
              <button class="qa-btn" (click)="analyzeSentiment()" [disabled]="aiLoading || !aiEventId" [class.spinning]="aiLoading">
                <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" stroke-width="1.5"/><path d="M8 2v2M8 12v2M2 8h2M12 8h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
                {{ aiLoading ? 'Analyse en cours…' : 'Analyser les avis' }}
              </button>
            </div>
            <div *ngIf="aiResult" style="margin-top:16px;padding:16px 18px;background:var(--surface-subtle);border:1px solid var(--border-subtle);border-radius:10px;">
              <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px;">{{ aiResult.count }} avis analysé(s)</div>
              <div style="font-size:13.5px;line-height:1.65;color:var(--text-primary);" [innerHTML]="formatAnalysis(aiResult.analysis)"></div>
            </div>
          </div>
        </section>
      </div>

      <!-- ─── TOAST ─── -->
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
    /* ━━━━━ RESET / LAYOUT ━━━━━ */
    .adm { font-family: 'Inter', -apple-system, system-ui, sans-serif; color: var(--text-primary); padding-bottom: 80px; }
    .adm * { box-sizing: border-box; }

    /* ━━━━━ TOPBAR ━━━━━ */
    .adm-topbar {
      display: flex; align-items: center;
      padding: 14px 0; margin-bottom: 24px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .adm-topbar-l { display: flex; align-items: center; gap: 12px; }
    .adm-crumb { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .adm-crumb-org { color: var(--text-tertiary); font-weight: 500; }
    .adm-crumb-sep { width: 14px; height: 14px; color: var(--text-quaternary); }
    .adm-crumb-page { color: var(--text-primary); font-weight: 600; }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ━━━━━ HEADER ━━━━━ */
    .adm-header { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 32px; }
    .adm-h1 { font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin: 0 0 6px; color: var(--text-primary); }
    .adm-sub { font-size: 14px; color: var(--text-secondary); margin: 0; line-height: 1.5; }

    /* Actions rapides */
    .quick-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 28px; }
    .qa-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px; border-radius: 9px; border: 1px solid var(--border-default); background: var(--surface-base); color: var(--text-primary); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .qa-btn svg { width: 15px; height: 15px; }
    .qa-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
    .qa-primary { background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; }
    .qa-primary:hover { background: var(--accent-primary-hover); border-color: var(--accent-primary-hover); color: #fff; }
    .qa-badge { background: #fff; color: var(--accent-primary); font-size: 11px; font-weight: 800; padding: 1px 7px; border-radius: 20px; }
    .qa-ghost { margin-left: auto; }
    .qa-ghost.spinning svg { animation: spin 1s linear infinite; }
    .adm-header-meta { display: flex; align-items: center; gap: 8px; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; position: relative; }
    .status-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; background: currentColor; opacity: 0.2; animation: pulse-dot 2s ease infinite; }
    @keyframes pulse-dot { 0%, 100% { opacity: 0.2; transform: scale(1); } 50% { opacity: 0; transform: scale(1.6); } }
    .status-dot-success { background: var(--accent-success); color: var(--accent-success); }
    .adm-status-label { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

    /* ━━━━━ METRICS ━━━━━ */
    .adm-metrics {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 32px;
    }
    @media (max-width: 1024px) { .adm-metrics { grid-template-columns: repeat(2, 1fr); } }
    .metric-card-clickable { cursor: pointer; }

    .metric-card {
      background: var(--surface-base); border: 1px solid var(--border-subtle);
      border-radius: 12px; padding: 18px 20px; transition: all 0.2s ease;
      position: relative; overflow: hidden;
    }
    .metric-card:hover { border-color: var(--border-default); box-shadow: var(--shadow-sm); }
    .metric-card-alert { border-color: rgba(227, 6, 19,0.35); background: var(--accent-primary-soft); }
    .metric-card-alert .metric-value { color: var(--accent-primary); }
    .metric-card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .metric-label { display: block; font-size: 12px; color: var(--text-tertiary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; }
    .metric-trend { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .metric-trend-up { background: var(--accent-success-soft); color: var(--accent-success); }
    .metric-trend-down { background: var(--accent-danger-soft); color: var(--accent-danger); }
    .metric-trend-neutral { background: var(--surface-muted); color: var(--text-secondary); }
    .metric-value { font-size: 28px; font-weight: 700; letter-spacing: -1px; line-height: 1.1; color: var(--text-primary); margin-bottom: 12px; }
    .metric-value-sm { font-size: 20px; }
    .metric-spark { height: 36px; margin-bottom: 8px; }
    .metric-spark svg { width: 100%; height: 100%; display: block; }
    .metric-services { display: flex; gap: 4px; margin-bottom: 8px; height: 36px; align-items: center; }
    .svc-dot { width: 8px; height: 8px; border-radius: 2px; cursor: help; }
    .svc-ok { background: var(--accent-success); }
    .svc-warn { background: var(--accent-warning); }
    .svc-err { background: var(--accent-danger); }
    .metric-foot { font-size: 12px; color: var(--text-tertiary); }

    /* ━━━━━ TABS ━━━━━ */
    .adm-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 28px; }
    .adm-tab {
      background: transparent; border: none; padding: 10px 14px; font-size: 14px; font-weight: 500;
      color: var(--text-secondary); cursor: pointer; font-family: inherit;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      display: inline-flex; align-items: center; gap: 8px;
      transition: color 0.15s ease;
    }
    .adm-tab:hover { color: var(--text-primary); }
    .adm-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); }
    .adm-tab-count { font-size: 11px; color: var(--text-tertiary); background: var(--surface-muted); padding: 1px 7px; border-radius: 20px; font-weight: 500; }
    .adm-tab.active .adm-tab-count { color: var(--text-primary); background: var(--surface-subtle); }

    /* ━━━━━ CONTENT GRID ━━━━━ */
    .adm-content { display: flex; flex-direction: column; gap: 20px; }
    .adm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 1024px) { .adm-grid-2 { grid-template-columns: 1fr; } }

    /* ━━━━━ PANEL ━━━━━ */
    .panel { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); }
    .panel-title { font-size: 14px; font-weight: 600; margin: 0; color: var(--text-primary); }
    .panel-count { font-size: 12px; color: var(--text-tertiary); font-weight: 500; margin-left: 6px; }
    .panel-meta { font-size: 12px; color: var(--text-tertiary); }
    .panel-tools { display: flex; gap: 8px; align-items: center; }
    .panel-body { padding: 20px; }
    .panel-body-flush { padding: 4px 0; }
    .panel-empty { padding: 24px; text-align: center; color: var(--text-tertiary); font-size: 13px; }

    .link-btn { background: none; border: none; padding: 0; color: var(--accent-primary); font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; }
    .link-btn:hover { color: var(--accent-primary-hover); }

    /* ━━━━━ RECENT ROW ━━━━━ */
    .rec-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 20px; cursor: pointer; transition: background 0.12s ease;
    }
    .rec-row:hover { background: var(--surface-subtle); }
    .rec-row + .rec-row { border-top: 1px solid var(--border-subtle); }
    .rec-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 11px; font-weight: 600; flex-shrink: 0;
    }
    .rec-thumb {
      width: 32px; height: 32px; border-radius: 8px;
      background-size: cover; background-position: center; flex-shrink: 0;
    }
    .rec-info { flex: 1; min-width: 0; }
    .rec-name { font-size: 13px; font-weight: 500; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rec-meta { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* Prochaines sessions */
    .up-row { display: flex; align-items: center; gap: 14px; padding: 12px 20px; }
    .up-row + .up-row { border-top: 1px solid var(--border-subtle); }
    .up-row:hover { background: var(--surface-subtle); }
    .up-date { width: 46px; flex-shrink: 0; text-align: center; background: var(--accent-primary-soft); border-radius: 9px; padding: 6px 0; }
    .up-d { display: block; font-size: 17px; font-weight: 800; color: var(--accent-primary); line-height: 1; }
    .up-m { display: block; font-size: 10px; font-weight: 600; color: var(--accent-primary); text-transform: uppercase; }
    .up-info { flex: 1; min-width: 0; }
    .up-title { font-size: 14px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .up-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-tertiary); margin-top: 4px; flex-wrap: wrap; }
    .up-stat { text-align: center; flex-shrink: 0; }
    .up-stat-v { display: block; font-size: 16px; font-weight: 800; color: var(--text-primary); }
    .up-stat-l { font-size: 10px; color: var(--text-tertiary); text-transform: uppercase; }

    /* ━━━━━ TIMELINE ━━━━━ */
    .timeline { position: relative; padding-left: 8px; }
    .timeline::before { content: ''; position: absolute; left: 11px; top: 8px; bottom: 8px; width: 1px; background: var(--border-default); }
    .tl-item { display: flex; gap: 14px; align-items: flex-start; padding: 8px 0; position: relative; }
    .tl-dot { width: 7px; height: 7px; border-radius: 50%; margin: 6px 4px 0; position: relative; z-index: 1; box-shadow: 0 0 0 3px var(--surface-base); }
    .tl-dot-success { background: var(--accent-success); }
    .tl-dot-info { background: var(--accent-primary); }
    .tl-dot-warning { background: var(--accent-warning); }
    .tl-dot-default { background: var(--text-quaternary); }
    .tl-content { flex: 1; }
    .tl-title { font-size: 13px; font-weight: 500; color: var(--text-primary); }
    .tl-meta { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }

    /* ━━━━━ TAGS ━━━━━ */
    .tag {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 20px;
      font-size: 11px; font-weight: 500; line-height: 1.5;
      letter-spacing: 0.2px;
    }
    .tag-admin         { background: #fef2f2; color: #991b1b; }
    .tag-organisateur  { background: #eff6ff; color: #1e40af; }
    .tag-participant   { background: #ecfdf5; color: #047857; }
    .tag-user          { background: var(--surface-muted); color: var(--text-secondary); }
    .tag-conférence    { background: #eff6ff; color: #1e40af; }
    .tag-concert       { background: #faf5ff; color: #6b21a8; }
    .tag-gala          { background: #fffbeb; color: #92400e; }
    .tag-sport         { background: #ecfdf5; color: #047857; }
    .tag-culture       { background: #ecfeff; color: #155e75; }
    .tag-event         { background: var(--surface-muted); color: var(--text-secondary); }

    /* ━━━━━ SEGMENTED FILTER ━━━━━ */
    .filter-segmented { display: flex; background: var(--surface-muted); border-radius: 8px; padding: 3px; }
    .filter-segmented button {
      background: transparent; border: none; padding: 5px 11px; font-size: 12px; font-weight: 500;
      color: var(--text-secondary); cursor: pointer; border-radius: 6px; font-family: inherit;
      transition: all 0.15s ease;
    }
    .filter-segmented button:hover { color: var(--text-primary); }
    .filter-segmented button.active { background: var(--surface-base); color: var(--text-primary); box-shadow: var(--shadow-xs); }

    /* ━━━━━ TABLE ━━━━━ */
    .adm-table-wrap { overflow-x: auto; }
    .adm-table { width: 100%; border-collapse: collapse; }
    .adm-table thead th {
      text-align: left; padding: 10px 20px; font-size: 11px; font-weight: 600;
      color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.6px;
      border-bottom: 1px solid var(--border-subtle); background: var(--surface-subtle);
    }
    .adm-table thead th.th-name { padding-left: 20px; }
    .adm-table thead th.th-actions { width: 1%; text-align: right; padding-right: 20px; }
    .adm-table tbody td { padding: 12px 20px; border-bottom: 1px solid var(--border-subtle); vertical-align: middle; font-size: 13px; }
    .adm-table tbody tr:last-child td { border-bottom: none; }
    .adm-table tbody tr { transition: background 0.12s ease; }
    .adm-table tbody tr:hover { background: var(--surface-subtle); }

    .cell-user, .cell-event { display: flex; align-items: center; gap: 12px; }
    .cell-avatar {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 11px; font-weight: 600; flex-shrink: 0;
    }
    .cell-thumb { width: 36px; height: 36px; border-radius: 6px; background-size: cover; background-position: center; flex-shrink: 0; }
    .fmt-tag { display: inline-block; font-size: 11px; font-weight: 700; color: var(--text-primary); }
    .fmt-mode { display: block; font-size: 11px; color: var(--text-tertiary); margin-top: 2px; }
    .cell-strong { color: var(--text-primary); font-weight: 500; }
    .cell-mute { color: var(--text-secondary); }
    .cell-faint { color: var(--text-tertiary); font-size: 12px; margin-top: 2px; }
    .cell-code {
      font-family: 'SF Mono', 'Monaco', 'Cascadia Code', monospace;
      font-size: 12px; background: var(--surface-muted); padding: 2px 6px; border-radius: 4px; color: var(--text-secondary);
    }

    .row-actions { display: inline-flex; align-items: center; gap: 8px; justify-content: flex-end; }
    .role-btn { border: 1px solid var(--accent-primary); background: var(--accent-primary-soft); color: var(--accent-primary); padding: 5px 11px; border-radius: 7px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; transition: all 0.15s ease; }
    .role-btn:hover:not(:disabled) { background: var(--accent-primary); color: #fff; }
    .role-btn:disabled { opacity: 0.5; cursor: wait; }
    .role-btn-muted { border-color: var(--border-default); background: var(--surface-muted); color: var(--text-secondary); }
    .role-btn-muted:hover:not(:disabled) { background: var(--surface-subtle); color: var(--text-primary); border-color: var(--border-strong); }

    .row-action {
      width: 28px; height: 28px; border-radius: 6px; border: 1px solid transparent;
      display: inline-flex; align-items: center; justify-content: center;
      background: transparent; cursor: pointer; color: var(--text-tertiary);
      transition: all 0.15s ease;
    }
    .row-action svg { width: 14px; height: 14px; }
    .row-action:hover { background: var(--surface-muted); color: var(--text-primary); }
    .row-action-danger:hover { background: var(--accent-danger-soft); color: var(--accent-danger); border-color: transparent; }

    .row-confirm { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; }
    .row-confirm > span { color: var(--accent-danger); font-weight: 500; }
    .confirm-yes { background: var(--accent-danger); color: white; border: none; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit; }
    .confirm-yes:hover { background: #b91c1c; }
    .confirm-no { background: var(--surface-base); border: 1px solid var(--border-default); padding: 5px 10px; border-radius: 6px; font-size: 12px; color: var(--text-secondary); cursor: pointer; font-family: inherit; }
    .confirm-no:hover { background: var(--surface-subtle); }

    /* ━━━━━ LOADING / EMPTY ━━━━━ */
    .panel-loading { padding: 16px 20px; }
    .skel-row { height: 44px; background: linear-gradient(90deg, var(--surface-subtle) 0%, var(--surface-muted) 50%, var(--surface-subtle) 100%); background-size: 200% 100%; border-radius: 8px; margin-bottom: 8px; animation: shimmer 1.6s ease infinite; }
    @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

    .panel-empty-state { text-align: center; padding: 64px 24px; }
    .empty-glyph { width: 48px; height: 48px; margin: 0 auto 14px; color: var(--text-quaternary); }
    .empty-glyph svg { width: 100%; height: 100%; }
    .empty-title { font-size: 14px; font-weight: 600; color: var(--text-primary); margin-bottom: 4px; }
    .empty-desc { font-size: 13px; color: var(--text-tertiary); }

    /* ━━━━━ TOAST ━━━━━ */
    .toast {
      position: fixed; bottom: 24px; right: 24px;
      display: flex; align-items: center; gap: 10px;
      background: #1a1a1a; color: white;
      padding: 12px 16px; border-radius: 10px;
      font-size: 13px; font-weight: 500;
      box-shadow: 0 12px 32px rgba(0,0,0,0.2);
      z-index: 9999;
      animation: toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toast-in { from { opacity: 0; transform: translateY(12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
    .toast-icon { width: 16px; height: 16px; flex-shrink: 0; }
    .toast-icon svg { width: 100%; height: 100%; }
    .toast-success .toast-icon { color: #4ade80; }
    .toast-error .toast-icon { color: #f87171; }

    /* ━━━━━ TAB ALERT BADGE ━━━━━ */
    .adm-tab-count-alert { background: var(--accent-danger, #dc2626) !important; color: #fff !important; animation: pulse-badge 2s ease infinite; }
    @keyframes pulse-badge { 0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.4); } 50% { box-shadow: 0 0 0 4px rgba(220,38,38,0); } }

    /* ━━━━━ STATUS PILL ━━━━━ */
    .status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .status-pill::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .status-pending  { background: #fffbeb; color: #b45309; }
    .status-approved { background: #ecfdf5; color: #047857; }
    .status-rejected { background: #fef2f2; color: #b91c1c; }

    /* ━━━━━ MODERATION CARDS ━━━━━ */
    .mod-list { display: flex; flex-direction: column; gap: 1px; background: var(--border-subtle); }
    .mod-card { display: flex; gap: 16px; padding: 18px 20px; background: var(--surface-base); align-items: flex-start; transition: background 0.12s ease; }
    .mod-card:hover { background: var(--surface-subtle); }
    .mod-thumb { width: 72px; height: 72px; border-radius: 10px; background-size: cover; background-position: center; flex-shrink: 0; }
    .mod-info { flex: 1; min-width: 0; }
    .mod-title { font-size: 15px; font-weight: 600; color: var(--text-primary); margin-bottom: 6px; }
    .mod-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; font-size: 12px; color: var(--text-tertiary); margin-bottom: 8px; }
    .mod-meta span { display: inline-flex; align-items: center; gap: 5px; }
    .mm-ico { width: 13px; height: 13px; flex-shrink: 0; }
    /* Onglets de statut des validations */
    .val-tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 20px; }
    .val-tab { display: inline-flex; align-items: center; gap: 8px; background: transparent; border: none; border-bottom: 2px solid transparent; padding: 10px 16px; margin-bottom: -1px; font-size: 13.5px; font-weight: 600; color: var(--text-secondary); cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .val-tab:hover { color: var(--text-primary); }
    .val-tab.active { color: var(--text-primary); border-bottom-color: var(--accent-primary); }
    .val-count { font-size: 11px; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: var(--surface-muted); color: var(--text-tertiary); }
    .val-tab.active .val-count { background: var(--accent-primary-soft); color: var(--accent-primary); }
    .val-count-alert { background: var(--accent-danger, #dc2626) !important; color: #fff !important; }
    .val-badge { font-size: 12px; font-weight: 600; padding: 5px 12px; border-radius: 8px; }
    .val-ok { background: #ecfdf5; color: #047857; }
    .val-ko { background: #fef2f2; color: #b91c1c; }
    .mod-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .mod-pills { display: flex; gap: 8px; }
    .mod-pill { font-size: 11px; font-weight: 500; padding: 3px 10px; border-radius: 6px; background: var(--surface-muted); color: var(--text-secondary); }
    .mod-actions { display: flex; flex-direction: column; gap: 8px; flex-shrink: 0; }
    .mod-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; border: 1px solid transparent; transition: all 0.15s ease; white-space: nowrap; }
    .mod-btn svg { width: 14px; height: 14px; }
    .mod-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .mod-approve { background: #059669; color: #fff; }
    .mod-approve:hover:not(:disabled) { background: #047857; }
    .mod-reject { background: var(--surface-base); color: #b91c1c; border-color: #fecaca; }
    .mod-reject:hover:not(:disabled) { background: #fef2f2; border-color: #f87171; }

    /* ━━━━━ VALIDATIONS : avatar ━━━━━ */
    .reg-ava { width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; font-weight: 700; font-size: 18px; color: #fff; background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover)); }
    .reg-ava-sm { width: 34px; height: 34px; border-radius: 10px; font-size: 14px; }

    /* ━━━━━ CERTIFICATS ━━━━━ */
    .badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; }
    .badge-neutral { background: var(--surface-muted); color: var(--text-secondary); }
    .badge-info { background: #eef2ff; color: #4338ca; }
    .badge-warn { background: #fffbeb; color: #b45309; }
    .badge-success { background: #ecfdf5; color: #047857; }
    .badge-danger { background: #fef2f2; color: #b91c1c; }

    .cert-task { display: flex; align-items: center; gap: 16px; padding: 18px 20px; margin-bottom: 20px;
      background: var(--accent-primary-soft); border: 1px solid rgba(227,6,19,0.25); border-radius: 12px; }
    .cert-task-ico { width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center;
      background: var(--surface-base); color: var(--accent-primary); }
    .cert-task-ico svg { width: 22px; height: 22px; }
    .cert-task-txt { flex: 1; min-width: 0; }
    .cert-task-title { font-size: 14.5px; font-weight: 700; color: var(--text-primary); }
    .cert-task-desc { font-size: 12.5px; color: var(--text-secondary); margin-top: 3px; }

    .cert-group { margin-bottom: 20px; }
    .cert-group-head { min-width: 0; }
    .cert-group-head .panel-meta { display: block; margin-top: 4px; }
    .cert-absent { color: #b45309; }
    .mod-hold { background: var(--surface-base); color: var(--text-secondary); border-color: var(--border-default); }
    .mod-hold:hover:not(:disabled) { background: var(--surface-subtle); color: var(--text-primary); }

    /* ━━━━━ COMMUNICATION ━━━━━ */
    .com-panel { max-width: 720px; }
    .com-form { display: flex; flex-direction: column; gap: 8px; padding: 4px 2px; }
    .com-label { font-size: 12.5px; font-weight: 600; color: var(--text-secondary); margin-top: 12px; }
    .com-audience { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    @media (max-width: 720px) { .com-audience { grid-template-columns: 1fr; } }
    .aud-pill { padding: 8px 16px; border-radius: 999px; border: 1px solid var(--border-subtle); background: var(--surface-base); color: var(--text-secondary); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .aud-pill:hover { color: var(--text-primary); }
    .aud-pill.active { background: var(--accent-primary); color: #fff; border-color: var(--accent-primary); }
    .com-input { width: 100%; padding: 11px 14px; border-radius: 10px; border: 1px solid var(--border-subtle); background: var(--surface-base); color: var(--text-primary); font-size: 14px; font-family: inherit; box-sizing: border-box; transition: border-color 0.15s ease; }
    .com-input:focus { outline: none; border-color: var(--accent-primary); }
    .com-textarea { resize: vertical; line-height: 1.6; }
    .com-count { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--text-secondary); margin: 4px 0; }
    .com-count-dot { width: 7px; height: 7px; border-radius: 50%; background: #059669; }
    .com-send { display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 10px; border: none; background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover)); color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; transition: all 0.16s ease; box-shadow: 0 6px 18px rgba(227, 6, 19,0.25); }
    .com-send svg { width: 16px; height: 16px; }
    .com-send:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(227, 6, 19,0.35); }
    .com-send:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    .com-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 16px; }
    .com-hint { font-size: 12.5px; color: var(--text-tertiary); }
    .com-alert { display: flex; align-items: flex-start; gap: 9px; margin-top: 14px; padding: 11px 13px; border-radius: 10px; border: 1px solid rgba(220,38,38,0.28); background: rgba(220,38,38,0.08); color: #dc2626; font-size: 13px; line-height: 1.5; }
    .com-alert svg { width: 16px; height: 16px; flex-shrink: 0; margin-top: 1px; }

    /* ━━━━━ COMMUNICATION — SÉLECTEUR DE DESTINATAIRES ━━━━━ */
    .rec-picker { border: 1px solid var(--border-subtle); border-radius: 12px; background: var(--surface-base); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
    .rec-picker-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .rec-search { flex: 1; min-width: 200px; padding: 9px 12px; font-size: 13px; }
    .rec-picker-actions { display: flex; gap: 12px; }
    .rec-linkbtn { background: none; border: none; padding: 0; font-family: inherit; font-size: 12.5px; font-weight: 600; color: var(--accent-primary); cursor: pointer; }
    .rec-linkbtn:disabled { color: var(--text-quaternary); cursor: not-allowed; }
    .rec-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .rec-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 6px 4px 11px; border-radius: 999px; background: var(--accent-primary-soft); color: var(--accent-primary); font-size: 12px; font-weight: 600; }
    .rec-chip-x { display: grid; place-items: center; width: 15px; height: 15px; border: none; border-radius: 50%; background: transparent; color: inherit; cursor: pointer; padding: 0; opacity: 0.65; }
    .rec-chip-x:hover { opacity: 1; }
    .rec-chip-x svg { width: 9px; height: 9px; }
    .rec-list { max-height: 260px; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: 10px; }
    .rec-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; border-bottom: 1px solid var(--border-subtle); transition: background 0.12s ease; }
    .rec-row:last-child { border-bottom: none; }
    .rec-row:hover { background: var(--surface-subtle); }
    .rec-row.checked { background: var(--accent-primary-soft); }
    .rec-row input[type="checkbox"] { width: 15px; height: 15px; accent-color: var(--accent-primary); cursor: pointer; flex-shrink: 0; }
    .rec-ava-sm { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; display: grid; place-items: center; color: #fff; font-size: 11px; font-weight: 700; }
    .rec-meta { display: flex; flex-direction: column; min-width: 0; }
    .rec-name { font-size: 13px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rec-mail { font-size: 11.5px; color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rec-empty { padding: 22px 14px; text-align: center; font-size: 13px; color: var(--text-tertiary); }

    /* ━━━━━ NAV INTERNE MODÉRATION / VALIDATIONS ━━━━━ */
    .review-nav { display: flex; gap: 6px; margin-bottom: 20px; background: var(--surface-subtle); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 6px; }
    .review-navbtn { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 9px; padding: 11px 16px; border-radius: 9px; border: none; background: transparent; color: var(--text-secondary); font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .review-navbtn svg { width: 16px; height: 16px; }
    .review-navbtn:hover { color: var(--text-primary); }
    .review-navbtn.active { background: var(--surface-base); color: var(--accent-primary); box-shadow: var(--shadow-sm); }
    .review-badge { font-size: 11px; font-weight: 800; padding: 1px 8px; border-radius: 20px; background: var(--accent-danger, #dc2626); color: #fff; }
    .review-navbtn:not(.active) .review-badge { background: var(--accent-primary-soft); color: var(--accent-primary); }
    @media (max-width: 640px) { .review-navbtn { font-size: 12.5px; padding: 10px 8px; } .review-navbtn svg { display: none; } }

    /* ━━━━━ DEMANDES DES FORMATEURS (modification / annulation) ━━━━━ */
    .chg-kind {
      display: inline-block; margin-bottom: 6px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase;
      color: var(--accent-primary, #e30613);
    }
    .chg-kind.chg-cancel { color: var(--accent-danger, #dc2626); }

    .chg-reason {
      margin-top: 10px; padding: 11px 14px; border-radius: 0 8px 8px 0;
      background: var(--accent-danger-soft, #fef2f2);
      border-left: 2px solid var(--accent-danger, #dc2626);
      font-size: 13.5px; line-height: 1.55; color: var(--text-primary);
    }
    .chg-reason-l {
      display: block; margin-bottom: 3px;
      font-size: 10.5px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--accent-danger, #dc2626);
    }

    .chg-diff { display: flex; flex-direction: column; gap: 5px; margin-top: 10px; }
    .chg-row {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px;
      font-size: 13px; line-height: 1.5;
    }
    .chg-field { min-width: 82px; font-size: 11.5px; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
    .chg-old { color: var(--text-tertiary); text-decoration: line-through; }
    .chg-arrow { color: var(--text-quaternary, #b4b4b8); }
    .chg-new { color: var(--text-primary); font-weight: 600; }
    .chg-empty { color: var(--text-tertiary); font-style: italic; }
    .chg-note { margin-top: 5px; font-size: 12.5px; color: var(--text-secondary); font-style: italic; }

    /* ━━━━━ COMMUNICATION — LAYOUT 2 COLONNES ━━━━━ */
    .com-layout { display: grid; grid-template-columns: 1.5fr 1fr; gap: 20px; align-items: start; }
    @media (max-width: 1024px) { .com-layout { grid-template-columns: 1fr; } }
    .com-form-panel { min-width: 0; padding: 20px; }
    .aud-card { text-align: left; flex: 1; min-width: 0; padding: 14px 16px; border-radius: 12px; border: 1px solid var(--border-subtle); background: var(--surface-base); cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .aud-card svg { width: 20px; height: 20px; color: var(--text-tertiary); margin-bottom: 8px; display: block; }
    .aud-card-t { font-size: 13.5px; font-weight: 700; color: var(--text-primary); }
    .aud-card-d { font-size: 12px; color: var(--text-tertiary); margin-top: 2px; }
    .aud-card:hover { border-color: var(--border-strong); }
    .aud-card.active { border-color: var(--accent-primary); background: var(--accent-primary-soft); }
    .aud-card.active svg, .aud-card.active .aud-card-t { color: var(--accent-primary); }
    .com-charcount { font-weight: 500; color: var(--text-tertiary); font-size: 11.5px; margin-left: 8px; }
    .com-aside { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 12px; }
    .com-reccard { background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover)); color: #fff; border-radius: 14px; padding: 22px 20px; text-align: center; box-shadow: 0 8px 22px rgba(227, 6, 19,0.22); }
    .com-reccard-num { font-size: 42px; font-weight: 800; letter-spacing: -1.5px; line-height: 1; }
    .com-reccard-lbl { font-size: 13px; font-weight: 600; opacity: 0.92; margin-top: 4px; }
    .com-reccard-sub { font-size: 12px; opacity: 0.82; margin-top: 8px; }
    .com-tips { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 16px 18px; }
    .com-tips-t { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; }
    .com-tips-t svg { width: 16px; height: 16px; color: var(--accent-primary); }
    .com-tips-list { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }
    .com-tips-list li { font-size: 12.5px; line-height: 1.5; color: var(--text-secondary); }

    /* ━━━━━ STATS KPIs ━━━━━ */
    .export-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 14px 18px; background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 12px; margin-bottom: 20px; }
    .export-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
    .export-btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .exp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border-default); background: var(--surface-subtle); color: var(--text-primary); font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .exp-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); }
    .stats-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    @media (max-width: 1024px) { .stats-kpis { grid-template-columns: repeat(2, 1fr); } }
    .kpi { background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 18px 20px; }
    .kpi-label { font-size: 12px; color: var(--text-tertiary); font-weight: 500; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px; }
    .kpi-val { font-size: 26px; font-weight: 800; letter-spacing: -1px; color: var(--accent-primary); }
    .kpi-foot { font-size: 12px; color: var(--text-tertiary); margin-top: 6px; }
    .kpi-bar { height: 6px; background: var(--surface-muted); border-radius: 4px; margin-top: 10px; overflow: hidden; }
    .kpi-bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent-primary), var(--accent-primary-hover)); border-radius: 4px; transition: width 0.6s ease; }

    /* ━━━━━ BAR CHARTS ━━━━━ */
    .bar-row { display: flex; align-items: center; gap: 12px; padding: 7px 0; }
    .bar-label { width: 110px; font-size: 13px; color: var(--text-secondary); flex-shrink: 0; text-transform: capitalize; }
    .bar-track { flex: 1; height: 10px; background: var(--surface-muted); border-radius: 6px; overflow: hidden; }
    .bar-fill { display: block; height: 100%; border-radius: 6px; transition: width 0.7s cubic-bezier(0.16,1,0.3,1); min-width: 2px; }
    .bar-value { width: 36px; text-align: right; font-size: 13px; font-weight: 600; color: var(--text-primary); flex-shrink: 0; }

    /* ━━━━━ TOP EVENTS ━━━━━ */
    .rec-rank { width: 26px; height: 26px; border-radius: 7px; background: var(--surface-muted); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .rec-bar { width: 80px; height: 6px; background: var(--surface-muted); border-radius: 4px; overflow: hidden; flex-shrink: 0; }
    .rec-bar span { display: block; height: 100%; background: linear-gradient(90deg, #e30613, #ec4899); border-radius: 4px; transition: width 0.6s ease; }
  `]
})
export class AdminComponent implements OnInit {
  private apiService = inject(ApiService);
  router = inject(Router);
  private route = inject(ActivatedRoute);
  private notifs = inject(NotifsService);

  activeTab: 'overview' | 'review' | 'certificates' | 'communication' | 'stats' = 'overview';
  reviewTab: 'moderation' | 'validations' | 'changes' = 'moderation';

  // ─── Certificats des sessions terminées ───
  /** Certificats en préparation ou différés, en attente d'une décision. */
  pendingCerts: any[] = [];
  loadingCerts = false;
  /** Id de l'inscription (ou de la session, pour un envoi groupé) en cours de traitement. */
  certBusy: string | null = null;

  // ─── Demandes des formateurs sur des sessions déjà publiées ───
  pendingChanges: any[] = [];
  loadingChanges = false;
  changeBusy: string | null = null;

  loadChanges(): void {
    this.loadingChanges = true;
    this.apiService.getPendingEventChanges().subscribe({
      next: d => { this.pendingChanges = d || []; this.loadingChanges = false; },
      error: () => { this.pendingChanges = []; this.loadingChanges = false; }
    });
  }

  /**
   * Écarts entre la session publiée et ce que le formateur propose.
   * L'admin décide sur pièces : il voit l'avant et l'après, pas un simple
   * « demande de modification » opaque.
   */
  changeDiff(e: any): { label: string; before: string; after: string }[] {
    const c = e?.pendingChange;
    if (!c) return [];
    const rows: { label: string; before: string; after: string }[] = [];
    const push = (label: string, before: any, after: any) => {
      if (after === null || after === undefined || after === '') return;
      if (String(before ?? '') === String(after)) return;
      rows.push({ label, before: this.orDash(before), after: String(after) });
    };
    push('Intitulé', e.title, c.title);
    if (c.eventDate) {
      const before = e.eventDate ? new Date(e.eventDate).toLocaleString('fr-FR') : '—';
      const after = new Date(c.eventDate).toLocaleString('fr-FR');
      if (before !== after) rows.push({ label: 'Date', before, after });
    }
    push('Lieu', e.location, c.location);
    push('Format', this.modeLabel(e), c.mode ? this.modeLabel({ mode: c.mode }) : null);
    push('Places', e.totalSeats, c.totalSeats);
    push('Lien visio', e.visioLink, c.visioLink);
    if (c.description && c.description !== e.description) {
      rows.push({ label: 'Descriptif', before: 'texte actuel', after: 'texte réécrit' });
    }
    return rows;
  }

  private orDash(v: any): string {
    const s = v === null || v === undefined ? '' : String(v);
    return s.trim() === '' ? '—' : s;
  }

  approveChange(e: any): void {
    this.changeBusy = e.id;
    this.apiService.approveEventChange(e.id).subscribe({
      next: () => {
        this.changeBusy = null;
        this.pendingChanges = this.pendingChanges.filter(x => x.id !== e.id);
        this.showToast('Demande approuvée — les inscrits ont été prévenus.', 'success');
        this.loadStats();
      },
      error: err => {
        this.changeBusy = null;
        this.showToast(err?.error?.error || "L'approbation a échoué.", 'error');
      }
    });
  }

  rejectChange(e: any): void {
    this.changeBusy = e.id;
    this.apiService.rejectEventChange(e.id).subscribe({
      next: () => {
        this.changeBusy = null;
        this.pendingChanges = this.pendingChanges.filter(x => x.id !== e.id);
        this.showToast('Demande refusée — la session reste inchangée.', 'success');
      },
      error: () => {
        this.changeBusy = null;
        this.showToast('Le refus a échoué.', 'error');
      }
    });
  }
  users: any[] = [];
  events: any[] = [];

  // ─── Validations d'inscriptions (workflow d'approbation) ───
  pendingRegs: any[] = [];
  loadingPending = false;
  regBusy: string | null = null;
  valTab: 'pending' | 'approved' | 'rejected' = 'pending';

  /** Liste affichée selon l'onglet de validation actif. */
  get valRegs(): any[] {
    if (this.valTab === 'pending') return this.pendingRegs;
    const status = this.valTab === 'approved' ? 'CONFIRMED' : 'REJECTED';
    return (this.registrations || []).filter(r => (r.status || '').toUpperCase() === status);
  }
  get approvedCountReg(): number { return (this.registrations || []).filter(r => (r.status || '').toUpperCase() === 'CONFIRMED').length; }
  get rejectedCountReg(): number { return (this.registrations || []).filter(r => (r.status || '').toUpperCase() === 'REJECTED').length; }

  // ─── Communication (email aux participants) ───
  // 'all'       → tous les participants
  // 'event'     → les inscrits d'une session
  // 'selection' → une ou plusieurs personnes cochées à la main
  comAudience: 'all' | 'event' | 'selection' = 'all';
  comEventId = '';
  comSubject = '';
  comMessage = '';
  comSending = false;
  comError = '';
  comSearch = '';
  /** Emails (en minuscules) des destinataires cochés en mode « Sélection ». */
  comSelected = new Set<string>();

  /** Derniers utilisateurs hors formateurs (cohérent avec la page Utilisateurs). */
  get recentUsers(): any[] {
    return this.users.filter(u => (u.role || '').toUpperCase() !== 'ORGANISATEUR').slice(0, 5);
  }
  registrations: any[] = [];
  usersCount = 0;
  eventsCount = 0;
  registrationsCount = 0;
  loadingUsers = false;
  loadingEvents = false;
  deleteConfirm: string | null = null;
  deleteEventConfirm: string | null = null;
  moderating: string | null = null;
  roleBusy: string | null = null;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  // Analyse IA des avis (sentiment)
  aiEventId = '';
  aiLoading = false;
  aiResult: { count: number; analysis: string } | null = null;

  private avatarPalette = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#30cfd0,#330867)',
    'linear-gradient(135deg,#a8edea,#fed6e3)',
    'linear-gradient(135deg,#ff9a9e,#fad0c4)'
  ];

  ngOnInit(): void {
    this.loadStats();
    this.loadPending();
    this.loadCertificates();
    // Ouvre l'onglet demandé via l'URL (?tab=…) depuis la sidebar
    this.route.queryParams.subscribe(p => {
      const t = p['tab'];
      // Modération et validations sont désormais fusionnées dans l'onglet « review ».
      // Rétro-compatibilité : les anciens liens (tab=moderation / validations) l'ouvrent
      // sur le bon sous-onglet.
      if (t === 'moderation' || t === 'validations' || t === 'changes') {
        this.activeTab = 'review';
        this.reviewTab = t === 'validations' ? 'validations' : t === 'changes' ? 'changes' : 'moderation';
        this.loadPending();
        this.loadChanges();
        return;
      }
      const allowed = ['review', 'certificates', 'communication', 'stats'];
      // Sans paramètre (clic sur « Tableau de bord ») → on revient à la vue d'ensemble
      this.activeTab = allowed.includes(t) ? (t as any) : 'overview';
      if (this.activeTab === 'review') { this.loadPending(); this.loadChanges(); }
      if (this.activeTab === 'certificates') this.loadCertificates();
    });
  }

  // ─── Certificats ───

  /** Charge la file des certificats à traiter et met la cloche à jour. */
  loadCertificates(): void {
    this.loadingCerts = true;
    this.apiService.getPendingCertificates().subscribe({
      next: d => {
        this.pendingCerts = d || [];
        this.loadingCerts = false;
        this.refreshCertificateQueue();
      },
      error: () => { this.pendingCerts = []; this.loadingCerts = false; this.refreshCertificateQueue(); }
    });
  }

  /** Regroupe la file par session et met la cloche à jour — après tout changement. */
  private refreshCertificateQueue(): void {
    this.regroupCertificates();
    this.announcePendingCertificates();
  }

  /**
   * Notification « vivante » de la file de certificats : elle se met à jour au
   * lieu de s'empiler, et disparaît une fois la file vide.
   */
  private announcePendingCertificates(): void {
    if (this.pendingCerts.length > 0) {
      this.notifs.seed('warn', 'event', 'Certificats à délivrer',
        `${this.pendingCerts.length} certificat(s) en attente sur ${this.certificateGroups.length} session(s) terminée(s)`,
        'ADMIN', { path: '/admin', query: { tab: 'certificates' } }, 'cert-queue');
    } else {
      this.notifs.drop('cert-queue', 'ADMIN');
    }
  }

  /**
   * Certificats regroupés par session terminée : l'administrateur traite une
   * promotion à la fois, pas une liste plate de participants.
   *
   * <p>Recalculé à chaque changement de la file plutôt qu'à chaque cycle de
   * détection : le `*ngFor` garde ainsi les mêmes objets et ne reconstruit pas
   * la liste sous le curseur.</p>
   */
  certificateGroups: { eventId: string; eventTitle: string; completedAt: any; items: any[] }[] = [];

  private regroupCertificates(): void {
    const groups = new Map<string, { eventId: string; eventTitle: string; completedAt: any; items: any[] }>();
    for (const r of this.pendingCerts) {
      const id = r.eventId || '—';
      let g = groups.get(id);
      if (!g) {
        g = {
          eventId: id,
          eventTitle: r.eventTitle || this.events.find(e => e.id === id)?.title || 'Session',
          completedAt: r.completedAt || r.eventDateStr,
          items: []
        };
        groups.set(id, g);
      }
      g.items.push(r);
    }
    // La session close le plus récemment d'abord : c'est celle qu'on attend.
    this.certificateGroups = Array.from(groups.values())
      .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
  }

  /** Certificats déjà délivrés, du plus récent au plus ancien. */
  get sentCertificates(): any[] {
    return (this.registrations || [])
      .filter(r => (r.certificateStatus || '').toUpperCase() === 'SENT')
      .sort((a, b) => new Date(b.certificateSentAt || 0).getTime() - new Date(a.certificateSentAt || 0).getTime());
  }

  certificateLabelOf(reg: any): string { return certificateLabel(reg?.certificateStatus); }
  certificateToneOf(reg: any): string { return certificateTone(reg?.certificateStatus); }

  /** Délivre le certificat d'un participant : il devient téléchargeable. */
  sendCertificate(reg: any): void {
    this.certBusy = reg.id;
    this.apiService.sendCertificate(reg.id).subscribe({
      next: () => {
        this.certBusy = null;
        this.pendingCerts = this.pendingCerts.filter(r => r.id !== reg.id);
        this.refreshCertificateQueue();
        this.showToast(`Certificat envoyé à ${reg.attendeeName || 'ce participant'} ✓`, 'success');
        this.loadStats();
      },
      error: err => {
        this.certBusy = null;
        this.showToast(err?.error?.error || "L'envoi du certificat a échoué.", 'error');
      }
    });
  }

  /** Diffère la décision : le certificat reste dans la file, le participant est informé. */
  holdCertificate(reg: any): void {
    this.certBusy = reg.id;
    this.apiService.holdCertificate(reg.id).subscribe({
      next: updated => {
        this.certBusy = null;
        reg.certificateStatus = updated?.certificateStatus || 'PENDING_APPROVAL';
        reg.certificateHandledBy = updated?.certificateHandledBy || reg.certificateHandledBy;
        this.showToast('Certificat gardé en attente — à traiter plus tard.', 'success');
      },
      error: err => {
        this.certBusy = null;
        this.showToast(err?.error?.error || "Impossible de différer ce certificat.", 'error');
      }
    });
  }

  /** Délivre en une fois tous les certificats en attente d'une session terminée. */
  sendAllCertificates(group: { eventId: string; eventTitle: string; items: any[] }): void {
    this.certBusy = group.eventId;
    this.apiService.sendCertificatesForEvent(group.eventId).subscribe({
      next: res => {
        this.certBusy = null;
        this.pendingCerts = this.pendingCerts.filter(r => r.eventId !== group.eventId);
        this.refreshCertificateQueue();
        this.showToast(`${res?.sent ?? group.items.length} certificat(s) envoyé(s) pour « ${group.eventTitle} » ✓`, 'success');
        this.loadStats();
      },
      error: () => {
        this.certBusy = null;
        this.showToast("L'envoi groupé a échoué.", 'error');
      }
    });
  }

  // ─── Validations d'inscriptions ───
  loadPending(): void {
    this.loadingPending = true;
    this.apiService.getPendingRegistrations().subscribe({
      next: d => { this.pendingRegs = d || []; this.loadingPending = false; },
      error: () => { this.pendingRegs = []; this.loadingPending = false; }
    });
  }
  get pendingRegCount(): number { return this.pendingRegs.length; }

  approveReg(id: string): void {
    this.regBusy = id;
    this.apiService.approveRegistration(id).subscribe({
      next: () => { this.regBusy = null; this.pendingRegs = this.pendingRegs.filter(r => r.id !== id); this.showToast('Inscription approuvée ✓', 'success'); },
      error: () => { this.regBusy = null; this.showToast("Erreur lors de l'approbation", 'error'); }
    });
  }
  rejectReg(id: string): void {
    this.regBusy = id;
    this.apiService.rejectRegistration(id).subscribe({
      next: () => { this.regBusy = null; this.pendingRegs = this.pendingRegs.filter(r => r.id !== id); this.showToast('Demande refusée', 'success'); },
      error: () => { this.regBusy = null; this.showToast('Erreur lors du refus', 'error'); }
    });
  }

  // ─── Communication (broadcast email) ───

  /** Change l'audience et remet à zéro l'erreur affichée. */
  setAudience(a: 'all' | 'event' | 'selection'): void {
    this.comAudience = a;
    this.comError = '';
  }

  /** Nom affichable d'un collaborateur. */
  fullName(u: any): string {
    return `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.username || u?.email || 'Collaborateur';
  }

  /** Participants adressables : rôle PARTICIPANT avec une adresse email renseignée. */
  get participantsPool(): any[] {
    return this.users
      .filter(u => (u.role || '').toUpperCase() === 'PARTICIPANT' && !!u.email)
      .sort((a, b) => this.fullName(a).localeCompare(this.fullName(b), 'fr'));
  }

  /** Participants visibles dans le sélecteur (filtrés par la recherche). */
  get filteredParticipants(): any[] {
    const q = this.comSearch.trim().toLowerCase();
    if (!q) return this.participantsPool;
    return this.participantsPool.filter(u => `${this.fullName(u)} ${u.email}`.toLowerCase().includes(q));
  }

  /** Participants actuellement cochés (pour les puces au-dessus de la liste). */
  get selectedParticipants(): any[] {
    return this.participantsPool.filter(u => this.comSelected.has(String(u.email).toLowerCase()));
  }

  get comSelectedCount(): number { return this.comSelected.size; }

  isSelected(u: any): boolean { return this.comSelected.has(String(u?.email || '').toLowerCase()); }

  /** Coche / décoche un destinataire. */
  toggleRecipient(u: any): void {
    const email = String(u?.email || '').toLowerCase();
    if (!email) return;
    if (this.comSelected.has(email)) this.comSelected.delete(email);
    else this.comSelected.add(email);
    this.comError = '';
  }

  /** Sélectionne tous les participants actuellement visibles (respecte la recherche). */
  selectAllVisible(): void {
    this.filteredParticipants.forEach(u => this.comSelected.add(String(u.email).toLowerCase()));
    this.comError = '';
  }

  clearSelection(): void { this.comSelected.clear(); }

  /**
   * Construit la liste d'emails à partir de l'audience choisie.
   * Les adresses sont nettoyées et dédoublonnées (insensible à la casse).
   */
  private resolveRecipients(): string[] {
    let emails: string[];

    if (this.comAudience === 'selection') {
      emails = this.selectedParticipants.map(u => u.email);
    } else if (this.comAudience === 'event') {
      if (!this.comEventId) return [];
      const attendeeIds = new Set(
        this.registrations
          .filter(r => r.eventId === this.comEventId && ['CONFIRMED', 'PENDING'].includes((r.status || '').toUpperCase()))
          .map(r => r.attendeeId)
      );
      emails = this.users
        .filter(u => attendeeIds.has(u.keycloakId) || attendeeIds.has(String(u.id)))
        .map(u => u.email);
    } else {
      // Tous les participants
      emails = this.participantsPool.map(u => u.email);
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of emails) {
      const email = String(raw || '').trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(email);
    }
    return out;
  }

  get comRecipientCount(): number { return this.resolveRecipients().length; }

  /** Libellé de l'audience affiché sur la carte « destinataires ». */
  get comAudienceLabel(): string {
    if (this.comAudience === 'all') return 'Tous les participants';
    if (this.comAudience === 'event') return this.comEventId ? 'Participants de la session' : 'Sélectionnez une session';
    return this.comSelectedCount > 0 ? 'Sélection manuelle' : 'Cochez au moins un participant';
  }

  /** Explique pourquoi le bouton d'envoi est désactivé. */
  get comEmptyHint(): string {
    if (this.comAudience === 'event' && !this.comEventId) return 'Choisissez une session pour cibler ses inscrits.';
    if (this.comAudience === 'selection') return 'Cochez au moins un destinataire dans la liste.';
    if (this.comAudience === 'event') return 'Aucun inscrit sur cette session.';
    return 'Aucun participant avec une adresse email.';
  }

  sendBroadcast(): void {
    this.comError = '';
    const subject = this.comSubject.trim();
    const message = this.comMessage.trim();

    // ─── Validation côté client (avant tout appel réseau) ───
    if (!subject) { this.failBroadcast("L'objet du message est obligatoire."); return; }
    if (!message) { this.failBroadcast('Le corps du message est obligatoire.'); return; }

    const recipients = this.resolveRecipients();
    if (recipients.length === 0) { this.failBroadcast(this.comEmptyHint); return; }

    this.comSending = true;
    this.apiService.broadcastEmail(subject, message, recipients).subscribe({
      next: (res: any) => {
        this.comSending = false;
        const sent = res?.sent ?? recipients.length;
        const failed = res?.failed ?? 0;
        if (sent === 0) {
          // Livré in-app mais aucun email n'est parti (SMTP indisponible) : on le dit clairement.
          this.failBroadcast("Le message a été déposé dans la boîte de réception des destinataires, mais aucun email n'a pu être envoyé (service de messagerie indisponible).");
          return;
        }
        this.showToast(
          failed > 0
            ? `Message envoyé à ${sent} destinataire(s) — ${failed} échec(s)`
            : `Message envoyé à ${sent} destinataire(s) ✓`,
          failed > 0 ? 'error' : 'success'
        );
        this.comSubject = ''; this.comMessage = '';
        this.comSelected.clear();
        this.comSearch = '';
      },
      error: (err: any) => {
        this.comSending = false;
        this.failBroadcast(this.broadcastErrorMessage(err));
      }
    });
  }

  /** Affiche l'erreur au même endroit (bandeau + toast), sans détail technique. */
  private failBroadcast(message: string): void {
    this.comError = message;
    this.showToast(message, 'error');
  }

  /**
   * Traduit une erreur HTTP en message lisible.
   * On n'affiche jamais `err.message` / `err.url` bruts : selon le contexte
   * d'exécution ils peuvent contenir un chemin local ou une trace technique.
   */
  private broadcastErrorMessage(err: any): string {
    const serverMsg = typeof err?.error?.error === 'string' ? err.error.error : '';
    switch (err?.status) {
      case 0:   return "Serveur injoignable. Vérifiez que la plateforme est bien démarrée, puis réessayez.";
      case 400: return serverMsg || 'Message invalide : vérifiez l\'objet, le contenu et les destinataires.';
      case 401: return 'Session expirée. Reconnectez-vous pour envoyer le message.';
      case 403: return "Vous n'avez pas les droits pour envoyer un message aux participants.";
      case 404: return "Le service de messagerie est introuvable. Contactez l'administrateur technique.";
      case 413: return 'Message trop volumineux. Raccourcissez le contenu et réessayez.';
      default:  return serverMsg || "L'envoi a échoué. Réessayez dans quelques instants.";
    }
  }

  catGradient(cat: string): string { return categoryGradient(cat); }
  loadStats(): void {
    this.loadingUsers = true; this.loadingEvents = true;
    this.apiService.getAllUsers().subscribe({
      next: d => { this.users = d; this.usersCount = d.length; this.loadingUsers = false; },
      error: () => { this.loadingUsers = false; }
    });
    // L'admin voit TOUS les événements (y compris en attente) pour la modération
    this.apiService.getAllEvents().subscribe({
      next: d => { this.events = d; this.eventsCount = d.length; this.loadingEvents = false; },
      error: () => { this.loadingEvents = false; }
    });
    this.apiService.getAllRegistrations().subscribe({
      next: d => { this.registrations = d || []; this.registrationsCount = this.registrations.length; },
      error: () => { this.registrations = []; }
    });
  }

  crumbLabel(): string {
    switch (this.activeTab) {
      case 'overview': return "Vue d'ensemble";
      case 'review': return 'Modération & validations';
      case 'certificates': return 'Gestion des certificats';
      case 'communication': return 'Communication';
      case 'stats': return 'Rapports & statistiques';
      default: return '';
    }
  }

  // ─── MODÉRATION ───
  private statusOf(e: any): string { return (e.status || '').toUpperCase(); }

  statusKey(e: any): string {
    const s = this.statusOf(e);
    if (s === 'PENDING') return 'pending';
    if (s === 'REJECTED') return 'rejected';
    return 'approved'; // APPROVED ou hérité (null)
  }
  statusLabel(e: any): string {
    const s = this.statusOf(e);
    if (s === 'PENDING') return 'En attente';
    if (s === 'REJECTED') return 'Refusé';
    return 'Publié';
  }

  typeLabel(e: any): string {
    const t = (e?.type || '').toUpperCase();
    return t === 'FORMATION' ? 'Formation' : t === 'WORKSHOP' ? 'Workshop' : t === 'CONFERENCE' ? 'Conférence' : t === 'SEMINAIRE' ? 'Séminaire' : 'Événement';
  }
  modeLabel(e: any): string {
    const m = (e?.mode || '').toUpperCase();
    if (m === 'EN_LIGNE') return 'En ligne';
    if (m === 'HYBRIDE') return 'Hybride';
    return 'Présentiel';
  }

  get pendingEvents(): any[] { return this.events.filter(e => this.statusOf(e) === 'PENDING'); }

  /** Sessions à venir (date future), triées par date croissante. */
  get upcomingEvents(): any[] {
    const now = Date.now();
    return this.events
      .filter(e => new Date(e.eventDate || 0).getTime() > now)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
  }

  countInscrits(e: any): number {
    return this.registrations.filter(r => (r.eventId === e.id) && r.status === 'CONFIRMED').length;
  }
  get pendingCount(): number { return this.pendingEvents.length; }
  get approvedCount(): number { return this.events.filter(e => { const s = this.statusOf(e); return s === 'APPROVED' || s === ''; }).length; }
  get rejectedCount(): number { return this.events.filter(e => this.statusOf(e) === 'REJECTED').length; }

  moderate(id: string, status: 'APPROVED' | 'REJECTED'): void {
    this.moderating = id;
    this.apiService.updateEventStatus(id, status).subscribe({
      next: () => {
        const ev = this.events.find(e => e.id === id);
        if (ev) ev.status = status;
        this.moderating = null;
        this.showToast(status === 'APPROVED' ? 'Événement approuvé et publié ✓' : 'Événement refusé', 'success');
      },
      error: () => { this.moderating = null; this.showToast('Erreur lors de la modération', 'error'); }
    });
  }

  // ─── STATISTIQUES ───
  private activeRegs(): any[] {
    return this.registrations.filter(r => (r.status || '').toUpperCase() !== 'CANCELLED');
  }

  /** Taux de présence global : check-ins validés / inscriptions confirmées. */
  get presenceRate(): number {
    const confirmed = this.activeRegs();
    if (!confirmed.length) return 0;
    const present = confirmed.filter(r => r.checkedIn).length;
    return Math.round((present / confirmed.length) * 100);
  }

  get occupancyRate(): number {
    let total = 0, reserved = 0;
    for (const e of this.events) {
      const t = e.totalSeats || 0;
      const avail = e.availableSeats ?? t;
      total += t; reserved += (t - avail);
    }
    return total > 0 ? Math.round((reserved / total) * 100) : 0;
  }

  get avgRegPerEvent(): number {
    return this.eventsCount > 0 ? Math.round((this.activeRegs().length / this.eventsCount) * 10) / 10 : 0;
  }

  statusBreakdown(): { label: string; count: number; pct: number; color: string }[] {
    const total = this.events.length || 1;
    const rows = [
      { label: 'Publiés', count: this.approvedCount, color: '#059669' },
      { label: 'En attente', count: this.pendingCount, color: '#d97706' },
      { label: 'Refusés', count: this.rejectedCount, color: '#dc2626' }
    ];
    return rows.map(r => ({ ...r, pct: Math.round((r.count / total) * 100) }));
  }

  categoryBreakdown(): { label: string; count: number; pct: number; color: string }[] {
    const colors = ['#e30613', '#ff3341', '#ec4899', '#0ea5e9', '#14b8a6', '#f59e0b'];
    const map = new Map<string, number>();
    for (const e of this.events) {
      const cat = e.category || 'Autre';
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    const max = Math.max(1, ...Array.from(map.values()));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([label, count], i) => ({ label, count, pct: Math.round((count / max) * 100), color: colors[i % colors.length] }));
  }

  usersByRole(): { label: string; count: number; pct: number; color: string }[] {
    const defs = [
      { key: 'ADMIN', label: 'Admin', color: '#dc2626' },
      { key: 'ORGANISATEUR', label: 'Organisateur', color: '#2563eb' },
      { key: 'PARTICIPANT', label: 'Participant', color: '#059669' }
    ];
    const total = this.users.length || 1;
    return defs.map(d => {
      const count = this.users.filter(u => (u.role || '').toUpperCase() === d.key).length;
      return { label: d.label, count, pct: Math.round((count / total) * 100), color: d.color };
    });
  }

  topEvents(): { title: string; count: number; pct: number }[] {
    const map = new Map<string, number>();
    for (const r of this.activeRegs()) {
      const id = r.eventId || r.event?.id;
      if (id) map.set(id, (map.get(id) || 0) + 1);
    }
    const ranked = Array.from(map.entries())
      .map(([id, count]) => ({ id, count, title: this.events.find(e => e.id === id)?.title || 'Événement' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    const max = Math.max(1, ...ranked.map(r => r.count));
    return ranked.map(r => ({ title: r.title, count: r.count, pct: Math.round((r.count / max) * 100) }));
  }

  initials(u: any): string { return ((u.firstName || 'U')[0] + (u.lastName || '?')[0]).toUpperCase(); }

  avatarBg(u: any): string {
    const seed = (u.keycloakId || u.email || '').length;
    return this.avatarPalette[seed % this.avatarPalette.length];
  }

  shortId(id: any): string {
    const s = String(id || '');
    // Derniers caractères : le début d'un ObjectId MongoDB est un horodatage,
    // identique pour tout un lot créé dans la même seconde.
    return s.length > 12 ? s.slice(-8).toUpperCase() : s || '—';
  }

  deleteUser(keycloakId: string): void {
    this.apiService.deleteUser(keycloakId).subscribe({
      next: () => { this.showToast('Utilisateur supprimé', 'success'); this.loadStats(); this.deleteConfirm = null; },
      error: () => this.showToast('Erreur lors de la suppression', 'error')
    });
  }

  assignRole(u: any, role: string): void {
    this.roleBusy = u.keycloakId;
    this.apiService.assignRole(u.keycloakId, role).subscribe({
      next: (res) => {
        this.roleBusy = null;
        u.role = role; // reflète immédiatement dans la table
        this.showToast(res?.message || 'Rôle mis à jour', 'success');
      },
      error: () => { this.roleBusy = null; this.showToast('Erreur lors du changement de rôle', 'error'); }
    });
  }

  /** Export CSV (sans dépendance, compatible Excel via BOM UTF-8). */
  exportCsv(kind: 'users' | 'events' | 'registrations'): void {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = 'export.csv';

    if (kind === 'users') {
      headers = ['Prénom', 'Nom', 'Email', 'Rôle', 'Département'];
      rows = this.users.map(u => [u.firstName, u.lastName, u.email, u.role, u.department]);
      filename = 'utilisateurs.csv';
    } else if (kind === 'events') {
      headers = ['Titre', 'Catégorie', 'Statut', 'Type', 'Mode', 'Date', 'Lieu', 'Places'];
      rows = this.events.map(e => [e.title, e.category, e.status || 'APPROVED', e.type, e.mode, e.eventDate, e.location, e.totalSeats]);
      filename = 'evenements.csv';
    } else {
      headers = ['Participant', 'Événement', 'Date inscription', 'Statut', 'Présent', "Type d'inscription"];
      rows = this.registrations.map(r => [r.attendeeName, r.eventTitle, r.registrationDate, r.status, r.checkedIn ? 'Oui' : 'Non', r.ticketType]);
      filename = 'inscriptions.csv';
    }

    const esc = (v: any) => {
      const s = (v ?? '').toString().replace(/"/g, '""');
      return /[";\n]/.test(s) ? `"${s}"` : s;
    };
    const csv = [headers, ...rows].map(line => line.map(esc).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
    this.showToast('Export généré : ' + filename, 'success');
  }

  deleteEvent(id: string): void {
    this.apiService.deleteEvent(id).subscribe({
      next: () => { this.showToast('Événement supprimé', 'success'); this.loadStats(); this.deleteEventConfirm = null; },
      error: () => this.showToast('Erreur lors de la suppression', 'error')
    });
  }

  // ─── ANALYSE IA DES AVIS ───
  analyzeSentiment(): void {
    if (!this.aiEventId) { this.showToast('Choisissez une session', 'error'); return; }
    this.aiLoading = true;
    this.aiResult = null;
    this.apiService.analyzeFeedback(this.aiEventId).subscribe({
      next: (r) => { this.aiResult = r; this.aiLoading = false; },
      error: () => { this.aiLoading = false; this.showToast('Analyse IA indisponible', 'error'); }
    });
  }

  /** Convertit la réponse IA (markdown léger) en HTML sûr (gras + retours ligne). */
  formatAnalysis(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }

  showToast(message: string, type: 'success' | 'error'): void {
    this.toast = { message, type };
    setTimeout(() => this.toast = null, 3500);
  }
}
