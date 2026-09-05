import { Component, OnInit, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';

/**
 * /dashboard agit comme un AIGUILLEUR :
 *   ADMIN          → /admin
 *   ORGANISATEUR   → /organizer
 *   PARTICIPANT    → /user
 *   (sans rôle)    → /welcome
 *
 * Cette route n'affiche pas de contenu propre, ce qui évite tout mélange
 * de features entre rôles.
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="route-router">
      <div class="rr-loader">
        <div class="rr-spinner"></div>
        <div class="rr-text">Préparation de votre espace…</div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .route-router { min-height: 60vh; display: flex; align-items: center; justify-content: center; }
    .rr-loader { text-align: center; }
    .rr-spinner {
      width: 44px; height: 44px;
      border: 3px solid var(--surface-muted);
      border-top-color: var(--accent-primary);
      border-radius: 50%;
      margin: 0 auto 18px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .rr-text { font-size: 14px; color: var(--text-secondary); font-weight: 500; }
  `]
})
export class DashboardComponent implements OnInit {
  private keycloak = inject(KeycloakService);
  private router = inject(Router);
  private zone = inject(NgZone);

  ngOnInit() {
    setTimeout(() => this.zone.run(() => this.redirect()), 100);
  }

  private redirect() {
    let roles: string[] = [];
    try {
      roles = this.keycloak.getUserRoles().map(r => r.toUpperCase());
    } catch {}

    const known = ['ADMIN', 'ORGANISATEUR', 'PARTICIPANT'];
    if (roles.some(r => known.includes(r))) {
      // Tous les rôles atterrissent sur l'accueil commun (role-aware)
      this.router.navigate(['/home'], { replaceUrl: true });
    } else {
      this.router.navigate(['/welcome'], { replaceUrl: true });
    }
  }
}
