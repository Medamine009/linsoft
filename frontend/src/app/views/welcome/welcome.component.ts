import { Component, OnInit, inject, AfterViewInit, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { ApiService } from '../../services/api.service';
import { SplashComponent } from '../splash/splash.component';

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, SplashComponent],
  template: `
    <app-splash *ngIf="showSplash" (done)="onSplashDone()"></app-splash>

    <div class="wlc" [class.wlc-fade-in]="!showSplash" [class.wlc-hidden]="showSplash">

      <!-- ─── AMBIENT BACKGROUND ─── -->
      <div class="wlc-bg">
        <div class="wlc-mesh"></div>
        <div class="wlc-aurora"></div>
        <div class="wlc-grid"></div>
        <div class="orb orb-1"></div>
        <div class="orb orb-2"></div>
        <div class="orb orb-3"></div>
        <!-- Particules flottantes -->
        <div class="wlc-particles">
          <span class="particle" *ngFor="let p of particles"
            [style.left.%]="p.x" [style.animation-delay.s]="p.delay"
            [style.animation-duration.s]="p.dur" [style.width.px]="p.size"
            [style.height.px]="p.size" [style.opacity]="p.op"></span>
        </div>
      </div>

      <!-- ─── NAV BAR ─── -->
      <header class="wlc-nav">
        <div class="wlc-brand">
          <img class="wlc-logo" src="assets/logos/linsoft-logo.png" alt="LINSOFT" />
          <span class="wlc-brand-sep"></span>
          <div>
            <span class="wlc-brand-name">Learning Center</span>
            <span class="wlc-brand-tag">Plateforme interne</span>
          </div>
        </div>
        <nav class="wlc-nav-links">
          <a (click)="scrollTo('features')">Fonctionnalités</a>
          <a (click)="scrollTo('how')">Comment ça marche</a>
          <a (click)="scrollTo('faq')">FAQ</a>
        </nav>
        <div class="wlc-nav-actions">
          <button class="wlc-btn wlc-btn-primary" (click)="login()">
            Se connecter
            <svg viewBox="0 0 14 14" fill="none"><path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </header>

      <!-- ─── HERO ─── -->
      <section class="wlc-hero">
        <div class="hero-left">
          <div class="wlc-eyebrow">
            <span class="eyebrow-pulse"><span></span></span>
            LINSOFT · Plateforme interne
          </div>

          <h1 class="wlc-h1">
            Vos événements et formations,
            <span class="wlc-h1-grad">au même endroit.</span>
          </h1>

          <p class="wlc-lead">
            La plateforme LINSOFT pour organiser les formations, séminaires et événements
            internes : inscriptions, gestion des présences, certificats et suivi des participations.
          </p>

          <div class="wlc-cta-row">
            <button class="wlc-btn wlc-btn-cta" (click)="login()">
              <span>Accéder à la plateforme</span>
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
            <button class="wlc-btn wlc-btn-outline" (click)="scrollTo('features')">
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v8M4 7l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              Découvrir
            </button>
          </div>

          <div class="wlc-trust">
            <div class="trust-text trust-text-solo">
              Présentiel, en ligne ou hybride — formations Cloud, DevOps et certifications.
            </div>
          </div>
        </div>

        <!-- Aperçu sobre : ce que fait la plateforme (factuel, pas de mockup marketing) -->
        <div class="hero-right">
          <ul class="hero-capabilities">
            <li>
              <span class="cap-ico"><svg viewBox="0 0 20 20" fill="none"><rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 8h14M7 2v4M13 2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
              <div><strong>Catalogue de formations & événements</strong><span>Présentiel, en ligne ou hybride</span></div>
            </li>
            <li>
              <span class="cap-ico"><svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
              <div><strong>Inscriptions & présences</strong><span>Validation par QR code au check-in</span></div>
            </li>
            <li>
              <span class="cap-ico"><svg viewBox="0 0 20 20" fill="none"><path d="M6 2h8l2 3v13H4V5l2-3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M7 9h6M7 12h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
              <div><strong>Suivi & rapports</strong><span>Taux de présence, départements, export</span></div>
            </li>
            <li>
              <span class="cap-ico"><svg viewBox="0 0 20 20" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M2 17c0-3 2.5-5 5-5s5 2 5 5M13 5a3 3 0 0 1 0 6M18 17c0-2-1-3.5-3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
              <div><strong>Rôles dédiés</strong><span>Administrateur · Formateur · Participant</span></div>
            </li>
          </ul>
        </div>
      </section>

      <!-- ─── PARTENAIRES & QUALITÉ ─── -->
      <section class="wlc-partners">
        <div class="wp-top">
          <span class="wp-label">Partenaires officiels de certification</span>
          <span class="wp-iso">
            <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Certifié ISO 29993
          </span>
        </div>
        <div class="wp-logos">
          <span class="wp-chip">Red Hat</span>
          <span class="wp-chip">AWS</span>
          <span class="wp-chip">Microsoft Azure</span>
          <span class="wp-chip">Kubernetes</span>
          <span class="wp-chip">Linux Foundation</span>
          <span class="wp-chip">SUSE</span>
          <span class="wp-chip">CompTIA</span>
        </div>
        <div class="wp-stats">
          <div class="wp-stat"><strong>15</strong><span>ans d'expertise</span></div>
          <div class="wp-stat"><strong>2 500+</strong><span>membres formés</span></div>
          <div class="wp-stat"><strong>50+</strong><span>sessions / an</span></div>
          <div class="wp-stat"><strong>4</strong><span>pays (TN · MA · DZ · LY)</span></div>
        </div>
      </section>

      <!-- ─── BRAND STRIP / TECH ─── -->
      <section class="wlc-techstrip">
        <div class="ts-label">Socle technique</div>
        <div class="ts-logos">
          <span>Angular 21</span>
          <span class="ts-sep"></span>
          <span>Spring Boot 3</span>
          <span class="ts-sep"></span>
          <span>Keycloak</span>
          <span class="ts-sep"></span>
          <span>MongoDB</span>
          <span class="ts-sep"></span>
          <span>RabbitMQ</span>
          <span class="ts-sep"></span>
          <span>Docker</span>
        </div>
      </section>

      <!-- ─── FEATURES ─── -->
      <section class="wlc-features" id="features">
        <div class="section-head">
          <div class="section-eyebrow">Fonctionnalités</div>
          <h2 class="section-title">Pensé pour les <span class="grad">formations et événements</span> de LINSOFT.</h2>
          <p class="section-sub">Du catalogue de formations au certificat de participation, en passant par le suivi des présences.</p>
        </div>

        <div class="features-grid">
          <article class="feature-card">
            <div class="ft-icon" style="background:linear-gradient(135deg,#e30613,#bd0410)">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="white" stroke-width="2"/><path d="M16 7l-2.5 5.5L8 15l2.5-5.5L16 7z" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>
            </div>
            <h3>Catalogue de formations</h3>
            <p>Formations Cloud, DevOps et certifications, filtrables par thème, format et date.</p>
          </article>

          <article class="feature-card">
            <div class="ft-icon" style="background:linear-gradient(135deg,#2a2a2e,#55555a)">
              <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="14" rx="2" stroke="white" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>
            </div>
            <h3>Participez en 1 clic</h3>
            <p>Demande d'inscription en un clic, confirmation envoyée par email dès la validation.</p>
          </article>

          <article class="feature-card">
            <div class="ft-icon" style="background:linear-gradient(135deg,#e30613,#bd0410)">
              <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="8" width="16" height="13" rx="2" stroke="white" stroke-width="2"/><rect x="4" y="8" width="16" height="6" fill="white" fill-opacity="0.3"/><path d="M8 8V5a4 4 0 0 1 8 0v3" stroke="white" stroke-width="2"/></svg>
            </div>
            <h3>QR codes sécurisés</h3>
            <p>Scan en temps réel à l'entrée. Génération via ZXing, validation côté serveur.</p>
          </article>

          <article class="feature-card">
            <div class="ft-icon" style="background:linear-gradient(135deg,#2a2a2e,#55555a)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 17l-1-1c-4-4-7-6.5-7-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8-2.5c0 4-3 6.5-7 10.5L12 17z" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>
            </div>
            <h3>Présentiel, en ligne, hybride</h3>
            <p>Sessions sur site ou à distance avec lien visio. Suivi de présence et certificat à la clé.</p>
          </article>

          <article class="feature-card">
            <div class="ft-icon" style="background:linear-gradient(135deg,#e30613,#bd0410)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 17l4-7 4 4 6-9 4 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3>Statistiques live</h3>
            <p>Dashboard analytique pour les organisateurs : inscriptions, présences et taux de remplissage.</p>
          </article>

          <article class="feature-card">
            <div class="ft-icon" style="background:linear-gradient(135deg,#2a2a2e,#55555a)">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 3l8 4v5c0 5-3.5 9-8 10-4.5-1-8-5-8-10V7l8-4z" stroke="white" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3>Sécurité d'entreprise</h3>
            <p>Auth Keycloak OAuth 2.0, JWT chiffrés, isolation des rôles, chiffrement bout-en-bout.</p>
          </article>
        </div>
      </section>

      <!-- ─── HOW IT WORKS ─── -->
      <section class="wlc-how" id="how">
        <div class="section-head">
          <div class="section-eyebrow">Démarrer en 3 étapes</div>
          <h2 class="section-title">Simple comme bonjour</h2>
        </div>

        <div class="how-steps">
          <div class="step-card">
            <div class="step-num">01</div>
            <div class="step-icon">
              <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </div>
            <h3>Connectez-vous</h3>
            <p>Accédez à la plateforme avec votre compte LINSOFT. Votre espace s'adapte à votre rôle.</p>
          </div>

          <div class="step-arrow">→</div>

          <div class="step-card">
            <div class="step-num">02</div>
            <div class="step-icon">
              <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M9 2v5M15 2v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
            </div>
            <h3>Inscrivez-vous ou publiez</h3>
            <p>Parcourez le catalogue et participez aux sessions, ou publiez une formation depuis le studio formateur.</p>
          </div>

          <div class="step-arrow">→</div>

          <div class="step-card">
            <div class="step-num">03</div>
            <div class="step-icon">
              <svg viewBox="0 0 24 24" fill="none"><path d="M3 17l4-7 4 4 6-9 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
            <h3>Participez & validez</h3>
            <p>Présentez votre code de présence à l'entrée, suivez la session, puis téléchargez votre certificat.</p>
          </div>
        </div>
      </section>

      <!-- ─── ACCÈS PAR RÔLE ─── -->
      <section class="wlc-pricing" id="roles">
        <div class="section-head">
          <div class="section-eyebrow">Accès</div>
          <h2 class="section-title">Un espace adapté à <span class="grad">chaque rôle</span></h2>
          <p class="section-sub">Participant, formateur ou administrateur : la plateforme s'adapte à vos responsabilités.</p>
        </div>

        <div class="pricing-grid">
          <div class="price-card price-free">
            <div class="pc-badge">Collaborateur</div>
            <h3 class="pc-name">Participant</h3>
            <p class="pc-role-desc">S'inscrit aux formations et événements, suit les sessions et récupère ses justificatifs.</p>
            <ul class="pc-features">
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Parcourir le catalogue</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>S'inscrire en un clic</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Confirmation par email</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Certificat de participation</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Historique des formations</li>
            </ul>
            <button class="pc-cta" (click)="login()">Se connecter</button>
          </div>

          <div class="price-card price-pro">
            <div class="pc-badge pc-badge-popular">Animation</div>
            <h3 class="pc-name">Formateur</h3>
            <p class="pc-role-desc">Crée et anime les formations, gère les inscriptions et valide les présences le jour J.</p>
            <ul class="pc-features">
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Créer formations et événements</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Présentiel, en ligne ou hybride</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Check-in par QR code</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Tableau de bord et statistiques</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Notifications automatiques</li>
            </ul>
            <button class="pc-cta pc-cta-pro" (click)="login()">Espace formateur</button>
          </div>

          <div class="price-card price-enterprise">
            <div class="pc-badge">Supervision</div>
            <h3 class="pc-name">Administrateur</h3>
            <p class="pc-role-desc">Supervise la plateforme, gère les comptes et modère les publications avant diffusion.</p>
            <ul class="pc-features">
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Gestion des collaborateurs</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Modération des publications</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Suivi par département</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Statistiques globales</li>
              <li><svg viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>Authentification Keycloak</li>
            </ul>
            <button class="pc-cta" (click)="login()">Console admin</button>
          </div>
        </div>
      </section>

      <!-- ─── FAQ ─── -->
      <section class="wlc-faq" id="faq">
        <div class="section-head">
          <div class="section-eyebrow">Questions fréquentes</div>
          <h2 class="section-title">Tout ce qu'il faut savoir</h2>
        </div>

        <div class="faq-list">
          <details class="faq-item">
            <summary>
              <span>Qui peut accéder à la plateforme ?</span>
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <p>La plateforme est destinée aux collaborateurs LINSOFT. La connexion se fait avec votre compte d'entreprise via Keycloak. L'administrateur attribue les rôles (participant, formateur).</p>
          </details>

          <details class="faq-item">
            <summary>
              <span>Comment se déroule une formation en ligne ?</span>
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <p>Le formateur indique le format (présentiel, en ligne ou hybride) et un lien visio pour les sessions à distance. Vous le retrouvez sur la page de la formation et dans « Mes inscriptions ».</p>
          </details>

          <details class="faq-item">
            <summary>
              <span>Comment obtenir mon certificat de participation ?</span>
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <p>Une fois votre présence validée à la session, le certificat devient téléchargeable au format PDF depuis votre espace, avec votre nom, l'intitulé de la formation et la date.</p>
          </details>

          <details class="faq-item">
            <summary>
              <span>Comment ma présence est-elle validée ?</span>
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <p>Chaque inscription confirmée porte un code de présence unique généré côté serveur. Le formateur le scanne le jour de la session pour valider votre présence et déclencher le suivi.</p>
          </details>

          <details class="faq-item">
            <summary>
              <span>Mes données sont-elles sécurisées ?</span>
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <p>L'authentification repose sur Keycloak (OAuth 2.0 / OIDC) avec des jetons JWT signés. Chaque microservice valide indépendamment l'accès ; les mots de passe ne transitent jamais en clair.</p>
          </details>

          <details class="faq-item">
            <summary>
              <span>Sur quelle architecture repose la plateforme ?</span>
              <svg viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </summary>
            <p>Frontend Angular et 8 microservices Spring Boot (Java 17) avec Spring Cloud, RabbitMQ pour la messagerie, MongoDB et PostgreSQL pour le stockage, le tout déployable sur OpenShift.</p>
          </details>
        </div>
      </section>

      <!-- ─── FINAL CTA ─── -->
      <section class="wlc-final-cta">
        <div class="fcta-bg">
          <div class="fcta-orb fcta-o-1"></div>
          <div class="fcta-orb fcta-o-2"></div>
          <div class="fcta-orb fcta-o-3"></div>
        </div>
        <div class="fcta-content">
          <div class="fcta-eyebrow">
            <span class="eyebrow-pulse"><span></span></span>
            Plateforme interne LINSOFT
          </div>
          <h2 class="fcta-title">
            Vos formations et événements,<br>
            <span class="grad-white">centralisés et suivis.</span>
          </h2>
          <p class="fcta-sub">
            Connectez-vous avec votre compte LINSOFT pour accéder au catalogue et à votre espace.
          </p>
          <div class="fcta-actions">
            <button class="fcta-btn fcta-primary" (click)="login()">
              Se connecter
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      </section>

      <!-- ─── FOOTER ─── -->
      <footer class="wlc-footer">
        <div class="footer-content">
          <div class="footer-brand">
            <img class="wlc-logo" src="assets/logos/linsoft-logo.png" alt="LINSOFT" />
            <span class="wlc-brand-sep"></span>
            <span class="wlc-brand-name">Learning Center</span>
          </div>
          <div class="footer-links">
            <div class="fl-col">
              <h4>Plateforme</h4>
              <a (click)="scrollTo('features')">Fonctionnalités</a>
              <a (click)="scrollTo('roles')">Accès par rôle</a>
              <a (click)="scrollTo('how')">Comment ça marche</a>
            </div>
            <div class="fl-col">
              <h4>Ressources</h4>
              <a href="http://localhost:8081/swagger-ui.html" target="_blank">API Docs</a>
              <a href="http://localhost:8761" target="_blank">Eureka</a>
              <a (click)="scrollTo('faq')">FAQ</a>
            </div>
            <div class="fl-col">
              <h4>Légal</h4>
              <a>Conditions d'utilisation</a>
              <a>Politique de confidentialité</a>
              <a>Mentions légales</a>
            </div>
          </div>
        </div>
        <!-- Developer credit + partner logos -->
        <div class="footer-credit">
          <div class="fc-left">
            <div class="fc-label">Développé par</div>
            <div class="fc-name">Med Amine Khadhraoui</div>
          </div>
          <div class="fc-logos">
            <a href="https://linsoft.com/en" target="_blank" rel="noopener noreferrer" class="fc-link" title="LINSOFT">
              <img src="assets/logos/linsoft.jpg" alt="LINSOFT" class="fc-logo" (error)="onFooterImgError($event, 'linsoft')">
            </a>
            <a href="https://tek-up.de/" target="_blank" rel="noopener noreferrer" class="fc-link" title="TEK-UP">
              <img src="assets/logos/tekup.png" alt="TEK-UP" class="fc-logo" (error)="onFooterImgError($event, 'tekup')">
            </a>
          </div>
        </div>

        <div class="footer-bottom">
          <div>© 2026 LINSOFT Learning Center · Projet PFE</div>
          <div class="fb-social">
            <a class="social-link" title="GitHub"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12c0 5.3 3.4 9.8 8.2 11.4.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.7.1-.7 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.4-1.3-5.4-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2 .1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.4 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6C20.6 21.8 24 17.3 24 12c0-6.6-5.4-12-12-12z"/></svg></a>
            <a class="social-link" title="LinkedIn"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM8.3 18.3H5.7V9.7h2.6v8.6zM7 8.5c-.9 0-1.5-.7-1.5-1.5S6.1 5.5 7 5.5s1.5.7 1.5 1.5S7.9 8.5 7 8.5zm11.3 9.8h-2.6v-4.7c0-1.4-.9-1.7-1.2-1.7s-1.4.2-1.4 1.7c0 .2 0 4.7 0 4.7H10.5V9.7h2.6v1.2c.3-.6 1-1.2 2.4-1.2s2.8 1.1 2.8 3.6v5z"/></svg></a>
            <a class="social-link" title="Twitter"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 5.8a8 8 0 0 1-2.4.7 4.1 4.1 0 0 0 1.8-2.3 8.3 8.3 0 0 1-2.7 1A4.1 4.1 0 0 0 15.7 4c-2.3 0-4.2 1.9-4.2 4.2 0 .3 0 .7.1 1A11.7 11.7 0 0 1 3 4.9a4.2 4.2 0 0 0 1.3 5.6 4 4 0 0 1-1.9-.5v.1c0 2 1.4 3.7 3.3 4.1a4 4 0 0 1-1.9.1c.5 1.7 2 2.9 3.8 2.9a8.3 8.3 0 0 1-6.1 1.7 11.7 11.7 0 0 0 6.3 1.9c7.6 0 11.7-6.3 11.7-11.7l-.1-.5A8 8 0 0 0 22 5.8z"/></svg></a>
          </div>
        </div>
      </footer>
    </div>
  `,
  styleUrls: ['./welcome.component.scss']
})
export class WelcomeComponent implements OnInit, AfterViewInit {
  private keycloak = inject(KeycloakService);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private el = inject(ElementRef);

  showSplash = true;

  particles = Array.from({ length: 30 }, () => ({
    x: Math.random() * 100,
    delay: -Math.random() * 20,
    dur: 12 + Math.random() * 16,
    size: 2 + Math.random() * 4,
    op: 0.2 + Math.random() * 0.5
  }));

  ngOnInit() {
    // Le splash s'affiche TOUJOURS sur /welcome. Si l'utilisateur est déjà
    // connecté, on attend la fin du splash avant de rediriger.
  }

  onSplashDone() {
    this.showSplash = false;
    // Si déjà connecté, redirection vers dashboard
    if (this.keycloak.isLoggedIn()) {
      this.apiService.getMe().subscribe();
      this.router.navigate(['/dashboard']);
    }
  }

  ngAfterViewInit() {
    // Animation reveal on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
    }, { threshold: 0.1 });
    this.el.nativeElement.querySelectorAll('.feature-card, .step-card, .testi, .price-card, .faq-item').forEach((el: Element) => observer.observe(el));
  }

  scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async login() {
    await this.keycloak.login({ redirectUri: window.location.origin + '/dashboard' });
  }

  onFooterImgError(event: Event, _which: string) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}

