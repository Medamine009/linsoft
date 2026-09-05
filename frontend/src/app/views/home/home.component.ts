import { Component, OnInit, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { primaryRole, AppRole } from '../../shared/role';

/**
 * Page d'accueil LINSOFT — sobre & corporate, « vibe société ».
 * Fond professionnel discret (grille + filigrane de marque), hero mesuré,
 * carte de marque compacte. Aucune donnée utilisateur, aucun raccourci.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="home">

      <!-- Fond photo pleine page, fondu vers le blanc -->
      <div class="page-photo"></div>
      <div class="page-shade"></div>
      <div class="page-glow"></div>

      <div class="page">
        <!-- ══ HERO ══ -->
        <section class="hero">
          <div class="eyebrow reveal r0">
            <span class="eyebrow-dot"></span>
            Centre de formation certifié Red&nbsp;Hat &amp; AWS
          </div>
          <h1 class="title reveal r1">
            Bonjour {{ firstName }},<br>
            <span class="accent">{{ statement }}</span>
          </h1>
          <p class="lede reveal r2">{{ tagline }}</p>
          <a class="cta reveal r3" [routerLink]="cta.link">
            {{ cta.label }}
            <svg viewBox="0 0 20 20" fill="none"><path d="M5 10h10M11 6l4 4-4 4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
          <div class="tags reveal r4">
            <span>Red Hat</span><span>AWS</span><span>DevOps</span><span>Cloud</span>
          </div>
        </section>

      <!-- ══ MISSION ══ -->
      <section class="about">
        <div class="about-eyebrow">Notre mission</div>
        <h2 class="about-title">Faire grandir les compétences des équipes, en continu.</h2>
        <p class="about-text">
          Formations certifiantes, workshops, conférences et séminaires — conçus par
          les experts LINSOFT, des fondamentaux Linux jusqu'au cloud à grande échelle.
        </p>
        <div class="pillars">
          <div class="pillar"><span class="pillar-k">Red Hat</span><span class="pillar-v">Partenaire certifié</span></div>
          <div class="pillar"><span class="pillar-k">AWS</span><span class="pillar-v">Cloud &amp; DevOps</span></div>
          <div class="pillar"><span class="pillar-k">Experts</span><span class="pillar-v">Formateurs terrain</span></div>
          <div class="pillar"><span class="pillar-k">Certificats</span><span class="pillar-v">Reconnus &amp; vérifiables</span></div>
        </div>
      </section>
      </div>

    </div>
  `,
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  private keycloak = inject(KeycloakService);
  private zone = inject(NgZone);
  private cd = inject(ChangeDetectorRef);

  firstName = '';
  role: AppRole = 'USER';

  get statement(): string {
    return {
      ADMIN: 'pilotez l’excellence de la formation.',
      ORGANISATEUR: 'concevez des formations d’exception.',
      PARTICIPANT: 'développez vos compétences.',
      USER: 'bienvenue chez LINSOFT.'
    }[this.role];
  }
  get tagline(): string {
    return {
      ADMIN: 'Votre centre de commande : catalogue, qualité et vision d’ensemble de l’activité de formation.',
      ORGANISATEUR: 'Votre studio de formation pour créer, animer et suivre vos sessions.',
      PARTICIPANT: 'Explorez le catalogue, inscrivez-vous aux sessions et récupérez vos certificats.',
      USER: 'La plateforme de formation interne de LINSOFT.'
    }[this.role];
  }
  get cta(): { label: string; link: string } {
    return {
      ADMIN: { label: 'Ouvrir le tableau de bord', link: '/admin' },
      ORGANISATEUR: { label: 'Accéder à mon studio', link: '/organizer' },
      PARTICIPANT: { label: 'Découvrir le catalogue', link: '/user' },
      USER: { label: 'Explorer', link: '/user' }
    }[this.role];
  }

  ngOnInit() {
    this.keycloak.loadUserProfile().then(profile => {
      this.zone.run(() => {
        this.firstName = profile.firstName || profile.username || 'collaborateur';
        this.role = primaryRole(this.keycloak.getUserRoles());
        this.cd.markForCheck();
      });
    }).catch(() => { this.role = 'USER'; this.cd.markForCheck(); });
  }
}
