import { Injectable, inject } from '@angular/core';
import { KeycloakService } from 'keycloak-angular';

/** Destination ouverte au clic sur une notification (ex : page de validation). */
export interface NotifLink {
  path: string;                        // ex : '/admin'
  query?: Record<string, any>;         // ex : { tab: 'validations' }
}

export interface AppNotif {
  type: 'success' | 'info' | 'warn' | 'error';
  icon: 'check' | 'event' | 'warn' | 'user' | 'payment' | 'mail';
  title: string;
  desc: string;
  at: number;        // timestamp (ms)
  unread: boolean;
  role?: string;     // rôle destinataire (ADMIN/ORGANISATEUR/PARTICIPANT) ; absent = visible par tous
  link?: NotifLink;  // page à ouvrir au clic ; absent = notification informative
  key?: string;      // identité stable d'une notification rafraîchie (cf. seed)
}

/** Clé de stockage historique : partagée par TOUS les utilisateurs du navigateur. */
const LEGACY_KEY = 'linsoft-notifs';
/** Préfixe des clés par utilisateur : linsoft-notifs:<sub Keycloak>. */
const KEY_PREFIX = 'linsoft-notifs:';

/**
 * Fil de notifications in-app (cloche du header), SCOPÉ PAR UTILISATEUR.
 *
 * Chaque notification appartient à un utilisateur précis (identifié par le `sub`
 * de son jeton Keycloak) : le stockage local est cloisonné par utilisateur, donc
 * un utilisateur ne peut jamais voir — ni marquer comme lue — la notification
 * d'un autre, même sur un poste partagé.
 *
 * Le rôle actif reste utilisé comme second filtre (un même compte peut porter
 * plusieurs rôles ; on n'affiche que celles du rôle courant).
 */
@Injectable({ providedIn: 'root' })
export class NotifsService {
  private keycloak = inject(KeycloakService);

  /** Identité (sub Keycloak) dont la liste `all` est actuellement chargée. */
  private loadedFor: string | null = null;
  private all: AppNotif[] = [];
  activeRole = '';

  constructor() {
    // La clé historique était commune à tous les comptes : on la purge pour
    // éviter qu'un ancien fil « partagé » ne réapparaisse chez quelqu'un d'autre.
    try { localStorage.removeItem(LEGACY_KEY); } catch { }
  }

  /**
   * Identifiant de l'utilisateur connecté, lu directement dans le jeton.
   * Résolu à chaque accès : le service reste correct quel que soit l'ordre
   * d'initialisation des composants.
   */
  private get userId(): string {
    try {
      const token: any = this.keycloak.getKeycloakInstance()?.tokenParsed;
      const id = token?.sub || token?.preferred_username;
      if (id) return String(id);
    } catch { }
    return '';
  }

  private get storageKey(): string { return KEY_PREFIX + this.userId; }

  /** Recharge `all` depuis le stockage si l'utilisateur connecté a changé. */
  private sync(): void {
    const id = this.userId;
    if (this.loadedFor === id) return;
    this.loadedFor = id;
    if (!id) { this.all = []; return; }      // non authentifié : aucun fil
    try {
      const raw = localStorage.getItem(KEY_PREFIX + id);
      this.all = raw ? JSON.parse(raw) : [];
    } catch {
      this.all = [];
    }
  }

  /** Fixe le rôle actif (défini au login). Filtre l'affichage des notifications. */
  setRole(role: string): void {
    this.activeRole = (role || '').toUpperCase();
    this.sync();
  }

  /** Notifications de l'utilisateur connecté, visibles pour son rôle actif. */
  get notifications(): AppNotif[] {
    this.sync();
    const r = this.activeRole;
    return this.all.filter(n => !n.role || n.role === r);
  }

  private persist(): void {
    if (!this.loadedFor) return;             // pas d'utilisateur -> rien à écrire
    this.all = this.all.slice(0, 60);
    try { localStorage.setItem(this.storageKey, JSON.stringify(this.all)); } catch { }
  }

  /** Ajoute une notification en tête, pour l'utilisateur connecté. */
  push(type: AppNotif['type'], icon: AppNotif['icon'], title: string, desc: string, role?: string, link?: NotifLink): void {
    this.sync();
    if (!this.loadedFor) return;             // aucune notification hors session
    const target = ((role ?? this.activeRole) || '').toUpperCase() || undefined;
    this.all.unshift({ type, icon, title, desc, at: Date.now(), unread: true, role: target, link });
    this.persist();
  }

  /**
   * Notification « vivante » : semée une fois puis remise à jour à chaque
   * rafraîchissement (le compteur d'inscriptions en attente change).
   *
   * `key` identifie la notification dans la durée : sans clé explicite, on
   * retombe sur le contenu (notification unitaire, ex. une inscription
   * confirmée précise). Les entrées écrites avant l'introduction des clés
   * (localStorage existant) sont rattachées par leur titre, ce qui leur donne
   * enfin leur destination au lieu de rester inertes au clic.
   */
  seed(type: AppNotif['type'], icon: AppNotif['icon'], title: string, desc: string, role: string, link?: NotifLink, key?: string): void {
    this.sync();
    if (!this.loadedFor) return;
    const R = (role || '').toUpperCase();
    const k = key || `${title}|${desc}`;
    const existing = this.all.find(n => {
      if (n.role !== R) return false;
      if (n.key) return n.key === k;
      return key ? n.title === title : (n.title === title && n.desc === desc);
    });

    if (existing) {
      // Le contenu a changé (ex : 2 demandes au lieu d'1) -> à relire.
      if (existing.desc !== desc) { existing.desc = desc; existing.unread = true; existing.at = Date.now(); }
      existing.key = k;
      existing.type = type;
      existing.icon = icon;
      if (link) existing.link = link;
      this.persist();
      return;
    }

    this.all.unshift({ type, icon, title, desc, at: Date.now(), unread: true, role: R, link, key: k });
    this.persist();
  }

  /** Retire une notification « vivante » devenue sans objet (plus rien en attente). */
  drop(key: string, role: string): void {
    this.sync();
    if (!this.loadedFor) return;
    const R = (role || '').toUpperCase();
    const before = this.all.length;
    this.all = this.all.filter(n => !(n.role === R && n.key === key));
    if (this.all.length !== before) this.persist();
  }

  /** Marque une notification précise comme lue (clic sur l'élément). */
  markRead(n: AppNotif): void {
    if (!n.unread) return;
    n.unread = false;
    this.persist();
  }

  get unreadCount(): number {
    return this.notifications.filter(n => n.unread).length;
  }

  /** Marque comme lues les seules notifications de l'utilisateur connecté. */
  markAllRead(): void {
    // `notifications` est une vue filtrée dont les éléments sont des références dans `all`
    this.notifications.forEach(n => n.unread = false);
    this.persist();
  }

  /** Vide uniquement les notifications visibles du rôle actif (pour l'utilisateur connecté). */
  clear(): void {
    this.sync();
    this.all = this.all.filter(n => n.role && n.role !== this.activeRole);
    this.persist();
  }

  /** Purge le fil local à la déconnexion (le poste peut être partagé). */
  reset(): void {
    this.loadedFor = null;
    this.all = [];
    this.activeRole = '';
  }
}
