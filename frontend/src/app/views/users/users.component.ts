import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { PeopleNavComponent, PeopleTab, PEOPLE_TABS } from '../../components/people-nav/people-nav.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, PeopleNavComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.scss']
})
export class UsersComponent implements OnInit {
  users: any[] = [];
  loading = false;
  search = '';
  sortBy: 'name' | 'email' | 'role' = 'name';
  sortDir: 'asc' | 'desc' = 'asc';
  selected = new Set<string>();
  deleteConfirm: string | null = null;
  roleBusy: string | null = null;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  /** Compte en cours d'édition (copie : la table n'est touchée qu'après succès). */
  editing: any = null;
  savingEdit = false;
  /** Compte dont on bascule l'état actif/inactif. */
  enableBusy: string | null = null;

  /** Un compte sans champ `enabled` (antérieur) est considéré actif. */
  isActive(u: any): boolean { return u?.enabled !== false; }

  openEdit(u: any): void { this.editing = { ...u }; }
  closeEdit(): void { this.editing = null; }

  saveEdit(): void {
    if (!this.editing) return;
    if (!this.editing.firstName?.trim()) { this.showToast('Le prénom est requis', 'error'); return; }
    this.savingEdit = true;
    this.apiService.updateUser(this.editing.keycloakId, this.editing).subscribe({
      next: updated => {
        this.users = this.users.map(u => u.keycloakId === updated.keycloakId ? updated : u);
        this.savingEdit = false;
        this.editing = null;
        this.showToast('Collaborateur mis à jour ✓', 'success');
      },
      error: () => { this.savingEdit = false; this.showToast('Erreur lors de l\'enregistrement', 'error'); }
    });
  }

  /** Active ou désactive un compte : l'état fait autorité côté Keycloak. */
  toggleEnabled(u: any): void {
    const next = !this.isActive(u);
    this.enableBusy = u.keycloakId;
    this.apiService.setUserEnabled(u.keycloakId, next).subscribe({
      next: () => {
        this.users = this.users.map(x => x.keycloakId === u.keycloakId ? { ...x, enabled: next } : x);
        this.enableBusy = null;
        this.showToast(next ? 'Compte activé ✓' : 'Compte désactivé — connexion bloquée', 'success');
      },
      error: () => { this.enableBusy = null; this.showToast('Erreur lors du changement d\'état', 'error'); }
    });
  }

  private palette = [
    'linear-gradient(135deg,#667eea,#764ba2)',
    'linear-gradient(135deg,#f093fb,#f5576c)',
    'linear-gradient(135deg,#4facfe,#00f2fe)',
    'linear-gradient(135deg,#43e97b,#38f9d7)',
    'linear-gradient(135deg,#fa709a,#fee140)',
    'linear-gradient(135deg,#30cfd0,#330867)'
  ];

  /** Onglet courant de la section « Gestion des personnes » (piloté par ?role=…). */
  activeTab: PeopleTab['key'] = 'participant';

  constructor(private apiService: ApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    // Les formateurs ont leur page dédiée : /users n'affiche que les
    // participants ou les administrateurs.
    this.route.queryParams.subscribe(p => {
      const slug = String(p['role'] || '').toLowerCase();
      this.activeTab = slug === 'admin' ? 'admin' : 'participant';
      this.selected.clear();
      this.deleteConfirm = null;
    });
    this.loadUsers();
  }

  /** Rôle backend correspondant à l'onglet ouvert. */
  get activeRole(): string {
    return PEOPLE_TABS.find(t => t.key === this.activeTab)?.role || 'PARTICIPANT';
  }

  get activeTabLabel(): string {
    return PEOPLE_TABS.find(t => t.key === this.activeTab)?.label || 'Participants';
  }

  /** Effectifs affichés sur les cartes de la barre de navigation. */
  get roleCounts(): Record<string, number> {
    return {
      participant: this.getRoleCount('PARTICIPANT'),
      formateur: this.getRoleCount('ORGANISATEUR'),
      admin: this.getRoleCount('ADMIN')
    };
  }

  /** Population de l'onglet ouvert : une seule à la fois. */
  get baseUsers(): any[] {
    return this.users.filter(u => (u.role || 'PARTICIPANT').toUpperCase() === this.activeRole);
  }

  get completeCount(): number { return this.baseUsers.filter(u => u.profileComplete).length; }

  get filteredUsers(): any[] {
    const q = this.search.toLowerCase();
    const filtered = this.baseUsers.filter(u => {
      return !q || `${u.firstName || ''} ${u.lastName || ''} ${u.email || ''}`.toLowerCase().includes(q);
    });
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const get = (u: any) => {
      if (this.sortBy === 'name') return `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      if (this.sortBy === 'email') return (u.email || '').toLowerCase();
      return (u.role || 'USER').toLowerCase();
    };
    return [...filtered].sort((a, b) => get(a) < get(b) ? -dir : get(a) > get(b) ? dir : 0);
  }

  /** Effectif d'un rôle sur l'ensemble des comptes (indépendant de l'onglet). */
  getRoleCount(role: string): number {
    return this.users.filter(u => (u.role || 'PARTICIPANT').toUpperCase() === role).length;
  }

  /** Change le rôle d'un collaborateur (Participant / Formateur / Administrateur). */
  assignRole(u: any, role: string): void {
    const target = (role || '').toUpperCase();
    if (!target || target === (u.role || '').toUpperCase()) return;
    this.roleBusy = u.keycloakId;
    this.apiService.assignRole(u.keycloakId, target).subscribe({
      next: (res) => {
        this.roleBusy = null;
        this.users = this.users.map(x => x.keycloakId === u.keycloakId ? { ...x, role: target } : x);
        this.showToast(res?.message || 'Rôle mis à jour ✓', 'success');
      },
      error: () => { this.roleBusy = null; this.showToast('Erreur lors du changement de rôle', 'error'); }
    });
  }
  getInitials(u: any): string { return ((u.firstName || 'U')[0] + (u.lastName || '?')[0]).toUpperCase(); }
  getAvatarBg(u: any): string {
    const seed = (u.keycloakId || u.email || '').length;
    return this.palette[seed % this.palette.length];
  }

  toggleSort(col: 'name' | 'email' | 'role') {
    if (this.sortBy === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = col; this.sortDir = 'asc'; }
  }

  toggleSelect(id: string) {
    this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id);
  }

  toggleSelectAll() {
    if (this.selected.size === this.filteredUsers.length) this.selected.clear();
    else this.filteredUsers.forEach(u => this.selected.add(u.keycloakId));
  }

  loadUsers(): void {
    this.loading = true;
    this.apiService.getAllUsers().subscribe({
      next: d => { this.users = d; this.loading = false; },
      error: () => { this.loading = false; this.showToast('Erreur de chargement', 'error'); }
    });
  }

  deleteUser(keycloakId: string): void {
    this.apiService.deleteUser(keycloakId).subscribe({
      next: () => {
        this.users = this.users.filter(u => u.keycloakId !== keycloakId);
        this.selected.delete(keycloakId);
        this.deleteConfirm = null;
        this.showToast('Utilisateur supprimé', 'success');
      },
      error: () => this.showToast('Erreur lors de la suppression', 'error')
    });
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toast = { message, type };
    setTimeout(() => this.toast = null, 3500);
  }
}
