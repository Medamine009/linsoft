import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Photo de profil de l'utilisateur connecté, partagée entre les composants.
 *
 * Le jeton Keycloak ne la porte pas : elle vient du user-service. La page de
 * profil la publie ici dès qu'elle change, ce qui met à jour l'avatar de la
 * barre supérieure sans rechargement ni nouvel appel réseau.
 */
@Injectable({ providedIn: 'root' })
export class CurrentUserService {
  private readonly photo = new BehaviorSubject<string | null>(null);

  /** Flux de la photo courante (`null` = pas de photo, on affiche les initiales). */
  readonly photoUrl$ = this.photo.asObservable();

  get photoUrl(): string | null { return this.photo.value; }

  setPhoto(url: string | null | undefined): void {
    const next = (url || '').trim() || null;
    if (next !== this.photo.value) this.photo.next(next);
  }

  /** Déconnexion : le poste peut être partagé. */
  reset(): void { this.photo.next(null); }
}
