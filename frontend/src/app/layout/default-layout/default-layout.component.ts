import { Component, OnInit, inject, HostListener, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { KeycloakService } from 'keycloak-angular';
import { filter } from 'rxjs/operators';

import { navItems } from './_nav';
import { primaryRole } from '../../shared/role';
import { ApiService } from '../../services/api.service';
import { NotifsService, AppNotif, NotifLink } from '../../services/notifs.service';
import { CurrentUserService } from '../../services/current-user.service';
import { ChatbotComponent } from '../../components/chatbot/chatbot.component';

/**
 * Destination de repli par titre de notification (références stables : le
 * template compare l'objet à chaque cycle de détection de changement).
 */
const FALLBACK_LINKS: Record<string, NotifLink> = {
  'Inscriptions à valider': { path: '/admin', query: { tab: 'validations' } },
  'Modération': { path: '/admin', query: { tab: 'moderation' } },
  'Inscription confirmée': { path: '/user/wallet' },
  'Demande non retenue': { path: '/user/wallet' },
  'Demande envoyée': { path: '/user/wallet' },
  'Inscription annulée': { path: '/user/wallet' },
  'Vos sessions': { path: '/organizer' },
  'Session soumise': { path: '/organizer' },
  'Événement créé': { path: '/events' }
};

interface NavItem {
  name: string;
  url?: string;
  icon?: string;
  title?: boolean;
  roles?: string[];
  linkProps?: { queryParams?: Record<string, any> };
  activeOpts?: any;
  /** Chemins supplémentaires sur lesquels l'entrée doit rester surlignée. */
  activePaths?: string[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, ChatbotComponent],
  templateUrl: './default-layout.component.html',
  styleUrls: ['./default-layout.component.scss']
})
export class DefaultLayoutComponent implements OnInit {
  private keycloak = inject(KeycloakService);
  private router = inject(Router);
  private apiService = inject(ApiService);
  private cd = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private notifs = inject(NotifsService);
  private currentUser = inject(CurrentUserService);

  navItems: NavItem[] = [];
  // Matching exact (chemin + query params) pour ne pas surligner plusieurs liens /admin à la fois
  navActiveOpts: any = { paths: 'exact', queryParams: 'exact', fragment: 'ignored', matrixParams: 'ignored' };
  // Entrées dont le query param n'est qu'un sous-onglet (ex : /events?type=…) :
  // le lien reste actif sur toute la section.
  navActivePathOpts: any = { paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' };
  sidebarCollapsed = false;
  cmdkOpen = false;
  cmdkQuery = '';
  notifOpen = false;
  /** La déconnexion passe par une confirmation : un clic isolé ne coupe pas la session. */
  logoutConfirm = false;
  /** Photo de profil affichée dans la barre supérieure (null = initiales). */
  photoUrl: string | null = null;
  user: { name: string; email: string; role: string; initials: string } | null = null;
  currentPath = '';
  themeMode: 'light' | 'dark' = 'light';

  // Fil de notifications in-app, alimenté par les actions réelles (création, inscription…).
  get notifications() { return this.notifs.notifications; }

  /** Convertit une entrée `_nav.ts` en élément affichable par la sidebar. */
  private toNavItem(i: any): NavItem {
    return {
      name: i.name,
      url: i.url,
      icon: i.iconComponent?.name,
      title: i.title,
      linkProps: i.linkProps,
      activeOpts: i.attributes?.['activeMatch'] === 'path' ? this.navActivePathOpts : this.navActiveOpts,
      activePaths: i.attributes?.['activePaths']
    };
  }

  /**
   * Surlignage d'une entrée couvrant plusieurs pages (ex : « Gestion des
   * personnes » sur /users et /formateurs). `routerLinkActive` ne connaît que
   * l'URL du lien : on complète avec une classe distincte pour ne pas entrer en
   * conflit avec la directive.
   */
  isNavActive(item: NavItem): boolean {
    if (!item.activePaths?.length) return false;
    const path = this.currentPath.split('?')[0];
    return item.activePaths.some(p => path === p || path.startsWith(p + '/'));
  }

  /** Libellé humain du rôle (topbar). */
  roleLabel(r: string): string {
    const map: Record<string, string> = { ADMIN: 'Administrateur', ORGANISATEUR: 'Organisateur', PARTICIPANT: 'Participant' };
    return map[(r || '').toUpperCase()] || 'Collaborateur';
  }

  /** Libellé relatif ("il y a 3 min", "il y a 2 h", "12 mai"). */
  timeLabel(at: number): string {
    const s = Math.floor((Date.now() - at) / 1000);
    if (s < 60) return "à l'instant";
    if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
    if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
    const d = new Date(at);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }

  // Quick actions for command palette
  quickActions = [
    { label: 'Aller au tableau de bord', url: '/dashboard', icon: 'chart', shortcut: 'D' },
    { label: 'Voir les événements', url: '/events', icon: 'calendar', shortcut: 'E' },
    { label: 'Gérer les utilisateurs', url: '/users', icon: 'users', shortcut: 'U' },
    { label: 'Voir les inscriptions', url: '/registrations', icon: 'check', shortcut: 'R' },
    { label: 'Se déconnecter', action: 'logout', icon: 'logout', shortcut: '⇧Q' }
  ];

  ngOnInit() {
    // Theme — synchronous
    const saved = localStorage.getItem('app-theme') as 'light' | 'dark' | null;
    if (saved) this.setTheme(saved);

    // Breadcrumb tracking
    this.currentPath = this.router.url;
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        this.zone.run(() => {
          this.currentPath = e.urlAfterRedirects;
          this.cd.markForCheck();
        });
      });

    // Default fallback nav (so the page isn't blank)
    this.navItems = (navItems as any[])
      .filter(i => !i.attributes?.roles)
      .map(i => this.toNavItem(i));

    // Keycloak — wrapped in NgZone so CD runs after async resolves
    const loggedIn = this.keycloak.isLoggedIn();
    if (!loggedIn) return;

    this.keycloak.loadUserProfile().then(profile => {
      this.zone.run(() => {
        const roles = this.keycloak.getUserRoles().map(r => r.toUpperCase());
        // Rôle effectif (le plus élevé) : un admin/organisateur possède aussi PARTICIPANT
        // via les default-roles du realm, mais ne doit PAS voir l'espace participant.
        const role = primaryRole(roles);
        this.user = {
          name: `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || profile.username || 'Utilisateur',
          email: profile.email || '',
          role,
          initials: ((profile.firstName || 'U')[0] + (profile.lastName || '?')[0]).toUpperCase()
        };
        // Identité de référence pour les notifications : l'id Keycloak du jeton.
        // C'est lui qui est enregistré dans organizerId / attendeeId, et il est
        // disponible sans dépendre du profil applicatif (/users/me peut échouer).
        this.keycloakId = (profile as any).id || '';

        this.navItems = (navItems as any[]).filter(item => {
          if (!item.attributes || !item.attributes['roles']) return true;
          const required = (item.attributes['roles'] as string[]).map(r => r.toUpperCase());
          return required.includes(role);
        }).map(i => this.toNavItem(i));

        // Notifications scopées : chaque rôle ne voit que les siennes
        this.notifs.setRole(this.user.role);
        this.loadInbox();
        this.cd.markForCheck();

        // Aucun rôle ne dépend plus de /users/me pour ses notifications :
        // l'identité vient du jeton. On interroge donc tout de suite.
        this.refreshNotifs(true);

        // Le profil applicatif porte la photo (absente du jeton Keycloak) et,
        // pour participant/organisateur, l'identité utilisée par les notifications.
        this.apiService.getMe().subscribe({
          next: (me: any) => this.zone.run(() => {
            this.me = me;
            this.currentUser.setPhoto(me?.photoUrl);
            if (this.user!.role !== 'ADMIN') this.refreshNotifs();
            this.cd.markForCheck();
          }),
          error: () => {}
        });
      });
    });

    // La page de profil publie la photo dès qu'elle change : l'avatar de la
    // barre suit sans rechargement.
    this.currentUser.photoUrl$.subscribe(url => this.zone.run(() => {
      this.photoUrl = url;
      this.cd.markForCheck();
    }));

    // Les files d'attente bougent pendant la session (une demande arrive, une
    // validation est traitée) : on resynchronise à chaque changement de page.
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.refreshNotifs());
  }

  /** Profil applicatif (photo, département…). */
  private me: any = null;
  /** Identifiant Keycloak du connecté — clé des notifications par rôle. */
  private keycloakId = '';
  /** Anti-rafale : une resynchronisation au plus toutes les 15 s. */
  private lastNotifRefresh = 0;

  /** Recalcule le fil de notifications du rôle courant depuis le backend. */
  refreshNotifs(force = false): void {
    if (!this.user) return;
    const now = Date.now();
    if (!force && now - this.lastNotifRefresh < 15_000) return;
    this.lastNotifRefresh = now;
    this.seedRoleNotifs(this.user.role, this.me);
  }

  /** Clic sur la cloche : on ouvre le panneau avec des données fraîches. */
  toggleNotifs(): void {
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen) this.refreshNotifs(true);
  }

  // ─── Boîte de réception (messages reçus) ───
  inboxMessages: any[] = [];
  messagesOpen = false;
  selectedMessage: any = null;

  get unreadMessagesCount(): number { return this.inboxMessages.filter(m => !m.read).length; }

  /** Récupère les messages in-app reçus (ex : diffusion admin). */
  private loadInbox(): void {
    this.apiService.getMyMessages().subscribe({
      next: (msgs: any[]) => this.zone.run(() => {
        this.inboxMessages = msgs || [];
        this.cd.markForCheck();
      }),
      error: () => {}
    });
  }

  /** Ouvre le détail d'un message et le marque comme lu. */
  openMessage(m: any): void {
    this.selectedMessage = m;
    this.markMessage(m);
  }

  /** Marque un message comme lu sans l'ouvrir (bouton dédié sur la ligne). */
  markMessageAsRead(m: any, ev: MouseEvent): void {
    ev.stopPropagation();          // ne pas ouvrir le message en même temps
    this.markMessage(m);
  }

  /** Vide le compteur de la boîte de réception. */
  markAllMessagesRead(): void {
    this.inboxMessages.filter(m => !m.read).forEach(m => this.markMessage(m));
  }

  /**
   * Passage à « lu », côté serveur et côté affichage.
   * L'état local est appliqué tout de suite pour que le compteur réagisse, et
   * remis en arrière si le serveur refuse — sinon le message paraîtrait lu
   * jusqu'au prochain rechargement, alors qu'il ne l'est pas.
   */
  private markMessage(m: any): void {
    if (!m || m.read) return;
    m.read = true;
    this.cd.markForCheck();
    this.apiService.markMessageRead(m.id).subscribe({
      next: () => {},
      error: () => this.zone.run(() => { m.read = false; this.cd.markForCheck(); })
    });
  }

  /** Marque une notification comme lue sans ouvrir la page associée. */
  markNotifRead(n: AppNotif, ev: MouseEvent): void {
    ev.stopPropagation();
    this.notifs.markRead(n);
  }

  backToMessages(): void { this.selectedMessage = null; }

  closeMessages(): void { this.messagesOpen = false; this.selectedMessage = null; }

  /** Libellé de l'expéditeur d'un message. */
  senderLabel(m: any): string {
    const r = (m?.senderRole || '').toUpperCase();
    if (r === 'ADMIN') return 'Administration LINSOFT';
    if (r === 'SYSTEM') return 'Notification LINSOFT';
    return m?.senderRole || 'LINSOFT';
  }

  /**
   * Identifiant sous lequel les données de l'utilisateur sont enregistrées.
   * Le jeton fait foi ; le profil applicatif ne sert que de secours, car
   * /users/me peut échouer sans que les notifications aient à en souffrir.
   */
  private identityId(me: any): string {
    return this.keycloakId || me?.keycloakId || '';
  }

  /** Alimente le fil de notifications avec des éléments pertinents pour le rôle. */
  private seedRoleNotifs(role: string, me: any): void {
    if (role === 'ADMIN') {
      this.apiService.getPendingRegistrations().subscribe({
        next: p => this.zone.run(() => {
          const n = (p || []).length;
          if (n) this.notifs.seed('info', 'user', 'Inscriptions à valider', `${n} demande(s) en attente de validation`, 'ADMIN', { path: '/admin', query: { tab: 'validations' } }, 'admin-pending-regs');
          else this.notifs.drop('admin-pending-regs', 'ADMIN');
          this.cd.markForCheck();
        }),
        error: () => {}
      });
      this.apiService.getEventsByStatus('PENDING').subscribe({
        next: e => this.zone.run(() => {
          const n = (e || []).length;
          if (n) this.notifs.seed('warn', 'event', 'Modération', `${n} événement(s) en attente de publication`, 'ADMIN', { path: '/admin', query: { tab: 'moderation' } }, 'admin-pending-events');
          else this.notifs.drop('admin-pending-events', 'ADMIN');
          this.cd.markForCheck();
        }),
        error: () => {}
      });
      // Demandes des formateurs sur des sessions déjà publiées (modification / annulation)
      this.apiService.getPendingEventChanges().subscribe({
        next: c => this.zone.run(() => {
          const list = c || [];
          if (!list.length) { this.notifs.drop('admin-pending-changes', 'ADMIN'); this.cd.markForCheck(); return; }
          const cancels = list.filter((e: any) => (e?.pendingChange?.type || '') === 'CANCEL').length;
          const updates = list.length - cancels;
          const parts: string[] = [];
          if (updates) parts.push(`${updates} modification(s)`);
          if (cancels) parts.push(`${cancels} annulation(s)`);
          this.notifs.seed(
            cancels ? 'warn' : 'info', 'event',
            'Demandes des formateurs',
            `${parts.join(' et ')} de session en attente de votre validation`,
            'ADMIN', { path: '/admin', query: { tab: 'changes' } }, 'admin-pending-changes'
          );
          this.cd.markForCheck();
        }),
        error: () => {}
      });
    } else if (role === 'PARTICIPANT') {
      const id = this.identityId(me);
      if (!id) return;
      this.apiService.getRegistrationsByAttendee(String(id)).subscribe({
        next: regs => this.zone.run(() => {
          (regs || []).forEach((r: any) => {
            const t = r.eventTitle || 'une session';
            if (r.status === 'CONFIRMED') this.notifs.seed('success', 'check', 'Inscription confirmée', `Votre place pour « ${t} » est confirmée`, 'PARTICIPANT', { path: '/user/wallet' }, `reg-ok-${r.id}`);
            else if (r.status === 'REJECTED') this.notifs.seed('warn', 'warn', 'Demande non retenue', `Votre demande pour « ${t} » n'a pas été retenue`, 'PARTICIPANT', { path: '/user/wallet' }, `reg-ko-${r.id}`);
          });
          this.cd.markForCheck();
        }),
        error: () => {}
      });
    } else if (role === 'ORGANISATEUR') {
      const id = this.identityId(me);
      if (!id) return;
      this.apiService.getEventsByOrganizer(String(id)).subscribe({
        next: evs => this.zone.run(() => {
          const list = evs || [];
          const st = (e: any) => String(e?.status || '').toUpperCase();

          // En attente de modération : une seule ligne, avec le compte à jour.
          const waiting = list.filter((e: any) => st(e) === 'PENDING').length;
          if (waiting) this.notifs.seed('info', 'event', 'En attente de validation',
            `${waiting} session(s) soumise(s) attendent la décision de l'administrateur`,
            'ORGANISATEUR', { path: '/organizer' }, 'org-waiting');
          else this.notifs.drop('org-waiting', 'ORGANISATEUR');

          // Événements marquants : une notification par session concernée.
          list.forEach((e: any) => {
            const t = e.title || 'une session';
            if (st(e) === 'REJECTED') {
              this.notifs.seed('warn', 'warn', 'Session refusée',
                `« ${t} » n'a pas été retenue par l'administrateur`,
                'ORGANISATEUR', { path: '/organizer' }, `org-rej-${e.id}`);
            }
            if (st(e) === 'CANCELLED') {
              this.notifs.seed('warn', 'warn', 'Session annulée',
                `L'annulation de « ${t} » a été approuvée, les inscrits ont été prévenus`,
                'ORGANISATEUR', { path: '/organizer' }, `org-cancel-${e.id}`);
            }
            if (e.pendingChange) {
              const kind = e.pendingChange.type === 'CANCEL' ? "L'annulation" : 'La modification';
              this.notifs.seed('info', 'event', 'Demande en cours',
                `${kind} de « ${t} » attend la validation de l'administrateur`,
                'ORGANISATEUR', { path: '/organizer' }, `org-chg-${e.id}`);
            } else {
              // La demande a été tranchée : la ligne « en cours » n'a plus lieu d'être.
              this.notifs.drop(`org-chg-${e.id}`, 'ORGANISATEUR');
            }

            // Issue de la demande, tant que le formateur n'en a pas pris acte.
            const d = e.lastChangeDecision;
            if (d) {
              const cancel = d.type === 'CANCEL';
              const ok = d.outcome === 'APPROVED';
              this.notifs.seed(
                ok ? 'success' : 'warn',
                ok ? 'check' : 'warn',
                ok ? 'Demande approuvée' : 'Demande refusée',
                ok
                  ? `${cancel ? "L'annulation" : 'La modification'} de « ${t} » est appliquée, les inscrits ont été prévenus`
                  : `${cancel ? "L'annulation" : 'La modification'} de « ${t} » n'a pas été retenue`,
                'ORGANISATEUR', { path: '/organizer' }, `org-dec-${e.id}`
              );
            } else {
              this.notifs.drop(`org-dec-${e.id}`, 'ORGANISATEUR');
            }
          });

          if (list.length) this.notifs.seed('info', 'event', 'Vos sessions',
            `Vous animez ${list.length} session(s) sur la plateforme`,
            'ORGANISATEUR', { path: '/organizer' }, 'org-sessions');
          this.cd.markForCheck();
        }),
        error: () => {}
      });
    }
  }

  /**
   * Clic sur une notification : on la marque lue, on ferme le panneau et,
   * si elle porte une destination, on ouvre la page concernée
   * (ex : « Inscriptions à valider » → console admin, onglet Validations).
   */
  openNotif(n: AppNotif): void {
    this.notifs.markRead(n);
    const link = this.notifTarget(n);
    this.notifOpen = false;
    if (!link) return;
    this.router.navigate([link.path], link.query ? { queryParams: link.query } : {});
  }

  /**
   * Destination d'une notification : celle qu'elle porte, sinon celle déduite
   * de son titre — les notifications stockées avant l'existence des liens
   * restaient sinon inertes au clic.
   */
  notifTarget(n: AppNotif): NotifLink | null {
    return n.link || FALLBACK_LINKS[n.title] || null;
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.cmdkOpen = !this.cmdkOpen;
      if (this.cmdkOpen) setTimeout(() => (document.getElementById('cmdk-input') as HTMLInputElement)?.focus(), 50);
    } else if (e.key === 'Escape' && this.logoutConfirm) {
      this.logoutConfirm = false;
    } else if (e.key === 'Escape' && this.cmdkOpen) {
      this.cmdkOpen = false;
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }

  get filteredActions() {
    const q = this.cmdkQuery.toLowerCase();
    if (!q) return this.quickActions;
    return this.quickActions.filter(a => a.label.toLowerCase().includes(q));
  }

  get breadcrumb(): string {
    const path = this.currentPath.split('?')[0].split('/').filter(Boolean)[0] || 'dashboard';
    const map: Record<string, string> = {
      dashboard: 'Tableau de bord',
      events: 'Gestion des événements',
      users: 'Gestion des personnes',
      formateurs: 'Gestion des personnes',
      registrations: 'Inscriptions',
      admin: 'Console Admin',
      organizer: 'Mon studio',
      user: 'Explorer'
    };
    return map[path] || 'Accueil';
  }

  toggleSidebar() { this.sidebarCollapsed = !this.sidebarCollapsed; }

  toggleTheme() {
    this.setTheme(this.themeMode === 'light' ? 'dark' : 'light');
  }

  setTheme(mode: 'light' | 'dark') {
    this.themeMode = mode;
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem('app-theme', mode);
  }

  runAction(action: any) {
    this.cmdkOpen = false;
    if (action.action === 'logout') { this.logoutConfirm = true; return; }
    if (action.url) this.router.navigateByUrl(action.url);
  }

  logout() {
    // Le poste peut être partagé : on vide le fil local et la boîte de réception
    // en mémoire avant de rendre la main à Keycloak.
    this.notifs.reset();
    this.currentUser.reset();
    this.inboxMessages = [];
    this.selectedMessage = null;
    this.keycloak.logout(window.location.origin);
  }

  get unreadCount(): number { return this.notifs.unreadCount; }

  markAllRead() { this.notifs.markAllRead(); }

  onQuickAction() {
    const roles = this.keycloak.getUserRoles().map(r => r.toUpperCase());
    if (roles.includes('ADMIN')) this.router.navigate(['/admin']);
    else if (roles.includes('ORGANISATEUR')) this.router.navigate(['/organizer']);
    else this.router.navigate(['/user']);
  }
}
