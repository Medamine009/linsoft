import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ApiService } from '../../services/api.service';
import { NotifsService } from '../../services/notifs.service';
import { CurrentUserService } from '../../services/current-user.service';
import { KeycloakService } from 'keycloak-angular';
import { primaryRole } from '../../shared/role';

/** Action sensible en attente de confirmation. */
type DangerAction = 'logout-all' | 'disable';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="pf">

      <!-- ══════════════ 1. BANDEAU ROUGE ══════════════ -->
      <header class="banner">
        <span class="banner-shape s1"></span>
        <span class="banner-shape s2"></span>
        <span class="banner-grid"></span>

        <div class="banner-in">
          <div class="banner-left">
            <div class="ava-wrap">
              <div class="ava" [style.background-image]="photoPreview ? 'url(' + photoPreview + ')' : null">
                <span *ngIf="!photoPreview">{{ initials }}</span>
              </div>
              <button class="ava-edit" (click)="pickPhoto()" [disabled]="uploadingPhoto" title="Changer la photo">
                <svg *ngIf="!uploadingPhoto" viewBox="0 0 16 16" fill="none"><path d="M2.5 5.4h2.2l1-1.6h4.6l1 1.6h2.2v7.2H2.5V5.4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="9" r="2.2" stroke="currentColor" stroke-width="1.5"/></svg>
                <span *ngIf="uploadingPhoto" class="spin"></span>
              </button>
              <input #photoInput type="file" accept="image/*" hidden (change)="onPhotoSelected($event)">
            </div>

            <div class="banner-id">
              <h1 class="banner-name">{{ fullName }}</h1>
              <div class="banner-role">{{ roleLabel }}</div>
              <div class="banner-mail" *ngIf="me?.email">{{ me.email }}</div>
              <span class="status-pill"><span class="dot"></span>Actif</span>
            </div>
          </div>

          <div class="banner-right">
            <button class="btn btn-white" (click)="startEdit()">
              <svg viewBox="0 0 16 16" fill="none"><path d="M11 2.2L3.4 9.8 2.6 13.4l3.6-.8 7.6-7.6-2.8-2.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
              Modifier le profil
            </button>
          </div>
        </div>
      </header>

      <!-- ══════════════ 2. REPÈRES DE COMPTE ══════════════
           Trois dates distinctes, chacune présente une seule fois dans la page. -->
      <div class="summary" *ngIf="me">
        <div class="sum-item">
          <span class="sum-ico"><svg viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M2 6.6h12M5.5 1.6V4M10.5 1.6V4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
          <div><div class="sum-l">Membre depuis</div><div class="sum-v">{{ me.createdAt ? (me.createdAt | date:'d MMMM yyyy') : '—' }}</div></div>
        </div>
        <div class="sum-item">
          <span class="sum-ico"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.8V8.2l2.2 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
          <div><div class="sum-l">Dernière connexion</div><div class="sum-v">{{ lastLogin ? (lastLogin | date:'d MMM yyyy, HH:mm') : '—' }}</div></div>
        </div>
        <div class="sum-item">
          <span class="sum-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2.2L3.4 9.8 2.6 13.4l3.6-.8 7.6-7.6-2.8-2.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>
          <div><div class="sum-l">Profil modifié le</div><div class="sum-v">{{ me.updatedAt ? (me.updatedAt | date:'d MMM yyyy, HH:mm') : '—' }}</div></div>
        </div>
      </div>

      <!-- ══════════════ 3. INFORMATIONS PERSONNELLES ══════════════ -->
      <section class="card" *ngIf="!editing && me">
        <header class="card-head">
          <h2><span class="head-ico"><svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5.6" r="2.8" stroke="currentColor" stroke-width="1.5"/><path d="M2.8 13.6c0-2.6 2.3-4.6 5.2-4.6s5.2 2 5.2 4.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>Informations personnelles</h2>
          <button class="btn btn-ghost btn-sm" (click)="startEdit()">Modifier</button>
        </header>
        <div class="fields">
          <div class="field"><div class="f-l">Prénom</div><div class="f-v" [class.empty]="!me.firstName">{{ me.firstName || 'Non renseigné' }}</div></div>
          <div class="field"><div class="f-l">Nom</div><div class="f-v" [class.empty]="!me.lastName">{{ me.lastName || 'Non renseigné' }}</div></div>
          <div class="field"><div class="f-l">Adresse email</div><div class="f-v" [class.empty]="!me.email">{{ me.email || 'Non renseignée' }}</div></div>
          <div class="field"><div class="f-l">Téléphone</div><div class="f-v" [class.empty]="!me.phoneNumber">{{ me.phoneNumber || 'Non renseigné' }}</div></div>
          <div class="field field-full"><div class="f-l">Département</div><div class="f-v" [class.empty]="!me.department">{{ me.department || 'Non renseigné' }}</div></div>
          <div class="field field-full"><div class="f-l">Biographie</div><div class="f-v" [class.empty]="!me.bio">{{ me.bio || 'Non renseignée' }}</div></div>
        </div>
      </section>

      <!-- Édition -->
      <section class="card" *ngIf="editing && form">
        <header class="card-head"><h2><span class="head-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M11 2.2L3.4 9.8 2.6 13.4l3.6-.8 7.6-7.6-2.8-2.8z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg></span>Modifier le profil</h2></header>

        <div class="photo-edit">
          <div class="ava ava-sm" [style.background-image]="form.photoUrl ? 'url(' + form.photoUrl + ')' : null">
            <span *ngIf="!form.photoUrl">{{ initials }}</span>
          </div>
          <div class="photo-edit-txt">
            <div class="pe-t">Photo de profil</div>
            <div class="pe-d">JPEG ou PNG. L'image est redimensionnée automatiquement.</div>
            <div class="pe-actions">
              <button class="btn btn-outline btn-sm" (click)="pickPhoto()" [disabled]="uploadingPhoto">
                {{ uploadingPhoto ? 'Traitement…' : 'Choisir une photo' }}
              </button>
              <button class="btn btn-ghost btn-sm" *ngIf="form.photoUrl" (click)="form.photoUrl = ''">Retirer</button>
            </div>
          </div>
        </div>

        <div class="form">
          <div class="fg"><label>Prénom <span class="req">*</span></label><input [(ngModel)]="form.firstName" placeholder="Ex : Marie"></div>
          <div class="fg"><label>Nom</label><input [(ngModel)]="form.lastName" placeholder="Ex : Dupont"></div>
          <div class="fg"><label>Adresse email</label><input type="email" [(ngModel)]="form.email" placeholder="vous@linsoft.tn"></div>
          <div class="fg"><label>Téléphone</label><input [(ngModel)]="form.phoneNumber" placeholder="+216 00 000 000"></div>
          <div class="fg fg-full"><label>Département</label><input [(ngModel)]="form.department" placeholder="Ex : Cloud, DevOps, Formation"></div>
          <div class="fg fg-full"><label>Biographie</label><textarea rows="4" [(ngModel)]="form.bio" placeholder="Votre parcours, vos domaines d'expertise…"></textarea></div>
        </div>

        <footer class="card-foot">
          <button class="btn btn-outline" (click)="cancelEdit()">Annuler</button>
          <button class="btn btn-primary" (click)="save()" [disabled]="saving">{{ saving ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </footer>
      </section>

      <!-- ══════════════ 4. SÉCURITÉ ══════════════ -->
      <section class="card" *ngIf="!editing">
        <header class="card-head">
          <h2><span class="head-ico"><svg viewBox="0 0 16 16" fill="none"><path d="M8 2l4.8 1.8v3.2c0 3.2-2.1 5.3-4.8 6.4-2.7-1.1-4.8-3.2-4.8-6.4V3.8L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.8 8l1.6 1.6L10.3 6.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span>Sécurité</h2>
          <span class="card-note">Gérée par LINSOFT Identity</span>
        </header>
        <div class="sec-grid">
          <div class="sec">
            <span class="sec-ico"><svg viewBox="0 0 16 16" fill="none"><rect x="3" y="7" width="10" height="7" rx="1.6" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
            <div class="sec-t">Mot de passe</div>
            <div class="sec-d">{{ passwordHint }}</div>
            <button class="btn btn-outline btn-sm btn-block" (click)="changePassword()">Modifier le mot de passe</button>
          </div>

          <div class="sec">
            <span class="sec-ico"><svg viewBox="0 0 16 16" fill="none"><rect x="5" y="2" width="6" height="12" rx="1.6" stroke="currentColor" stroke-width="1.5"/><path d="M7.4 11.8h1.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
            <div class="sec-t">
              Double authentification
              <span class="badge" [ngClass]="twoFactor === true ? 'badge-ok' : twoFactor === false ? 'badge-off' : 'badge-neutral'">
                {{ twoFactor === true ? 'Activée' : twoFactor === false ? 'Désactivée' : 'Non renseignée' }}
              </span>
            </div>
            <div class="sec-d">Une seconde vérification à la connexion.</div>
            <button class="btn btn-outline btn-sm btn-block" (click)="openAccount('#/security/signingin')">Configurer</button>
          </div>

          <div class="sec">
            <span class="sec-ico"><svg viewBox="0 0 16 16" fill="none"><rect x="1.8" y="3" width="12.4" height="8" rx="1.4" stroke="currentColor" stroke-width="1.5"/><path d="M5.4 13.4h5.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>
            <div class="sec-t">Sessions</div>
            <div class="sec-d">{{ sessionsHint }}</div>
            <button class="btn btn-outline btn-sm btn-block" (click)="openAccount('#/security/device-activity')">Voir les sessions</button>
          </div>
        </div>
      </section>

      <!-- ══════════════ 6. ZONE DANGEREUSE ══════════════ -->
      <section class="danger" *ngIf="!editing">
        <h2 class="danger-t">Zone dangereuse</h2>
        <div class="danger-row">
          <div>
            <div class="dr-t">Déconnecter tous les appareils</div>
            <div class="dr-d">Ferme vos sessions ouvertes partout, y compris celle-ci.</div>
          </div>
          <button class="btn btn-danger-out btn-sm" (click)="confirming = 'logout-all'">Déconnecter</button>
        </div>
        <div class="danger-row">
          <div>
            <div class="dr-t">Désactiver le compte</div>
            <div class="dr-d">Votre compte ne pourra plus se connecter. Un administrateur devra le réactiver.</div>
          </div>
          <button class="btn btn-danger-out btn-sm" (click)="confirming = 'disable'">Désactiver</button>
        </div>
      </section>

      <!-- Confirmation -->
      <div class="modal-ov" *ngIf="confirming" (click)="confirming = null"></div>
      <div class="modal" *ngIf="confirming">
        <h3>{{ confirming === 'disable' ? 'Désactiver votre compte ?' : 'Déconnecter tous les appareils ?' }}</h3>
        <p>
          {{ confirming === 'disable'
              ? 'Vous serez déconnecté immédiatement et ne pourrez plus vous reconnecter tant qu\\'un administrateur n\\'aura pas réactivé le compte.'
              : 'Toutes vos sessions seront fermées, sur cet appareil comme sur les autres. Vous devrez vous reconnecter.' }}
        </p>
        <div class="modal-actions">
          <button class="btn btn-outline" (click)="confirming = null">Annuler</button>
          <button class="btn btn-danger" (click)="runDanger()" [disabled]="dangerBusy">
            {{ dangerBusy ? 'En cours…' : confirming === 'disable' ? 'Désactiver' : 'Déconnecter' }}
          </button>
        </div>
      </div>

      <!-- Toast -->
      <div *ngIf="toast" class="toast" [class.t-error]="toast.type==='error'">
        <svg *ngIf="toast.type==='success'" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.5"/><path d="M5.2 8.2l2 2 3.8-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <svg *ngIf="toast.type==='error'" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.5"/><path d="M8 4.6v4.2M8 11.2v.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <span>{{ toast.message }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .pf {
      font-family: 'Inter', -apple-system, system-ui, sans-serif;
      color: var(--text-primary);
      max-width: 1120px; margin: 0 auto; padding-bottom: 56px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .pf * { box-sizing: border-box; }

    /* ══ 1. Bandeau ══ */
    .banner {
      position: relative; overflow: hidden;
      min-height: 240px;
      background:
        radial-gradient(120% 150% at 12% 0%, rgba(255,255,255,0.20) 0%, transparent 55%),
        linear-gradient(115deg, #9f0410 0%, #c40512 34%, #e30613 66%, #ff4438 100%);
      border-radius: 18px;
      padding: 34px 36px;
      display: flex; align-items: center;
      box-shadow: 0 16px 40px -18px rgba(227, 6, 19, 0.62);
    }
    .banner-shape { position: absolute; border-radius: 50%; pointer-events: none; }
    .banner-shape.s1 { width: 340px; height: 340px; right: -100px; top: -140px; background: rgba(255,255,255,0.10); }
    .banner-shape.s2 { width: 210px; height: 210px; right: 150px; bottom: -125px; background: rgba(0,0,0,0.08); }
    .banner-grid {
      position: absolute; inset: 0; pointer-events: none; opacity: 0.13;
      background-image: linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px);
      background-size: 44px 44px;
      -webkit-mask-image: linear-gradient(100deg, #000 0%, transparent 62%);
      mask-image: linear-gradient(100deg, #000 0%, transparent 62%);
    }
    .banner-in {
      position: relative; z-index: 2; width: 100%;
      display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
    }
    .banner-left { display: flex; align-items: center; gap: 22px; min-width: 0; }

    .ava-wrap { position: relative; flex-shrink: 0; }
    .ava {
      width: 108px; height: 108px; border-radius: 50%;
      display: grid; place-items: center;
      background: rgba(255,255,255,0.18); background-size: cover; background-position: center;
      border: 4px solid #fff;
      box-shadow: 0 12px 30px rgba(0,0,0,0.26), 0 0 0 9px rgba(255,255,255,0.12);
      color: #fff; font-size: 34px; font-weight: 700; letter-spacing: 0.5px;
    }
    .ava-edit {
      position: absolute; right: -2px; bottom: -2px;
      width: 32px; height: 32px; border-radius: 50%;
      display: grid; place-items: center;
      background: #fff; border: none; cursor: pointer;
      color: var(--accent-primary, #e30613);
      box-shadow: 0 3px 10px rgba(0,0,0,0.22);
      transition: transform 0.16s ease;
    }
    .ava-edit:hover:not(:disabled) { transform: scale(1.08); }
    .ava-edit:disabled { cursor: wait; }
    .ava-edit svg { width: 15px; height: 15px; }
    .spin {
      width: 13px; height: 13px; border-radius: 50%;
      border: 2px solid rgba(227,6,19,0.25); border-top-color: var(--accent-primary, #e30613);
      animation: sp 0.7s linear infinite;
    }
    @keyframes sp { to { transform: rotate(360deg); } }

    .banner-id { min-width: 0; }
    .banner-name { font-size: 30px; font-weight: 800; letter-spacing: -0.8px; color: #fff; margin: 0; line-height: 1.12; }
    .banner-role {
      display: inline-block; margin-top: 8px;
      padding: 3px 12px; border-radius: 20px;
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.3);
      font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; color: #fff;
    }
    .banner-mail { font-size: 13.5px; color: rgba(255,255,255,0.82); margin-top: 8px; }
    .status-pill {
      display: inline-flex; align-items: center; gap: 7px; margin-top: 12px;
      padding: 5px 13px; border-radius: 20px;
      background: rgba(255,255,255,0.16);
      border: 1px solid rgba(255,255,255,0.32);
      color: #fff; font-size: 12px; font-weight: 600;
      backdrop-filter: blur(6px);
    }
    .status-pill .dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 0 3px rgba(74,222,128,0.28); }
    .banner-right { flex-shrink: 0; }

    /* ══ 2. Résumé ══ */
    .summary {
      display: grid; grid-template-columns: repeat(3, 1fr);
      background: var(--surface-base); border: 1px solid var(--border-subtle); border-radius: 14px;
      overflow: hidden;
    }
    @media (max-width: 800px) { .summary { grid-template-columns: 1fr; } }
    .sum-item { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-right: 1px solid var(--border-subtle); min-width: 0; }
    .sum-item:last-child { border-right: none; }
    @media (max-width: 800px) {
      .sum-item { border-right: none; border-bottom: 1px solid var(--border-subtle); }
      .sum-item:last-child { border-bottom: none; }
    }
    .sum-ico {
      width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
      display: grid; place-items: center;
      background: var(--accent-primary-soft); color: var(--accent-primary);
    }
    .sum-ico svg { width: 15px; height: 15px; }
    .sum-l { font-size: 11px; color: var(--text-tertiary); font-weight: 600; }
    .sum-v { font-size: 13.5px; font-weight: 600; margin-top: 2px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ══ Cartes ══ */
    /* Couleur explicite : CoreUI déclare globalement une couleur de texte sur la
       classe .card, calée sur son thème clair. Sans cette ligne, tout le texte de
       la carte qui hérite (titres, valeurs) reste noir en mode sombre. */
    .card {
      background: var(--surface-base); border: 1px solid var(--border-subtle);
      color: var(--text-primary);
      border-radius: 14px; padding: 18px 22px 20px;
      transition: border-color 0.18s ease, box-shadow 0.18s ease;
    }
    .card:hover { border-color: var(--border-default); box-shadow: 0 4px 18px rgba(0,0,0,0.04); }
    .card-head {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding-bottom: 14px; margin-bottom: 16px; border-bottom: 1px solid var(--border-subtle);
    }
    .card-head h2 { display: flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 700; letter-spacing: -0.1px; margin: 0; color: var(--text-primary); }
    /* Pastille rouge : rappelle l'accent de marque sur chaque section. */
    .head-ico {
      width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
      display: grid; place-items: center;
      background: var(--accent-primary-soft); color: var(--accent-primary);
    }
    .head-ico svg { width: 15px; height: 15px; }
    .card-note { font-size: 12px; color: var(--text-tertiary); }
    .card-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border-subtle); }
    .tag { padding: 3px 10px; border-radius: 6px; background: var(--accent-primary-soft); color: var(--accent-primary); font-size: 11px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; }

    /* ══ Badges ══ */
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 6px; font-size: 11.5px; font-weight: 600; line-height: 1.6; border: 1px solid transparent; white-space: nowrap; }
    .badge .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .badge-ok { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .badge-off { background: var(--surface-muted); color: var(--text-secondary); border-color: var(--border-default); }
    .badge-neutral { background: var(--surface-muted); color: var(--text-tertiary); border-color: var(--border-subtle); }

    /* ══ Boutons ══ */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 7px;
      height: 38px; padding: 0 16px; border-radius: 9px;
      font-family: inherit; font-size: 13px; font-weight: 600; line-height: 1;
      cursor: pointer; white-space: nowrap; border: 1px solid transparent;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease;
    }
    .btn svg { width: 15px; height: 15px; flex-shrink: 0; }
    .btn-sm { height: 32px; padding: 0 13px; font-size: 12.5px; }
    .btn-block { width: 100%; }
    .btn-white { background: #fff; color: var(--accent-primary, #e30613); box-shadow: 0 4px 14px rgba(0,0,0,0.16); }
    .btn-white:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.22); }
    .btn-primary { background: var(--accent-primary); color: #fff; }
    .btn-primary:hover:not(:disabled) { background: var(--accent-primary-hover); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline { background: var(--surface-base); color: var(--text-primary); border-color: var(--border-default); }
    .btn-outline:hover:not(:disabled) { background: var(--surface-subtle); border-color: var(--text-tertiary); }
    .btn-outline:disabled { opacity: 0.6; cursor: wait; }
    .btn-ghost { background: transparent; color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--surface-subtle); color: var(--text-primary); }
    .btn-danger { background: #dc2626; color: #fff; }
    .btn-danger:hover:not(:disabled) { background: #b91c1c; }
    .btn-danger:disabled { opacity: 0.6; cursor: wait; }
    .btn-danger-out { background: transparent; color: #b91c1c; border-color: #fca5a5; }
    .btn-danger-out:hover { background: #fef2f2; border-color: #dc2626; }

    /* ══ 3. Champs ══ */
    .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; }
    @media (max-width: 620px) { .fields { grid-template-columns: 1fr; } }
    .field-full { grid-column: 1 / -1; }
    .f-l { font-size: 11.5px; color: var(--text-tertiary); font-weight: 600; margin-bottom: 4px; }
    .f-v { font-size: 14px; font-weight: 600; line-height: 1.5; word-break: break-word; color: var(--text-primary); }
    .f-v.empty { font-weight: 400; color: var(--text-tertiary); }

    /* ══ Formulaire ══ */
    .photo-edit { display: flex; align-items: center; gap: 18px; padding-bottom: 18px; margin-bottom: 18px; border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
    .ava-sm {
      width: 72px; height: 72px; font-size: 22px; border: 2px solid var(--border-subtle);
      background-color: var(--accent-primary); box-shadow: none;
    }
    .pe-t { font-size: 13.5px; font-weight: 600; }
    .pe-d { font-size: 12.5px; color: var(--text-tertiary); margin-top: 3px; }
    .pe-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 620px) { .form { grid-template-columns: 1fr; } }
    .fg { display: flex; flex-direction: column; gap: 6px; }
    .fg-full { grid-column: 1 / -1; }
    .fg label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
    .req { color: var(--accent-primary); }
    .fg input, .fg textarea {
      height: 38px; padding: 0 12px;
      background: var(--surface-base); color: var(--text-primary);
      border: 1px solid var(--border-default); border-radius: 9px;
      font-family: inherit; font-size: 13.5px; outline: none;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .fg textarea { height: auto; padding: 10px 12px; resize: vertical; line-height: 1.55; }
    .fg input:focus, .fg textarea:focus { border-color: var(--accent-primary); box-shadow: 0 0 0 3px var(--accent-primary-soft); }

    /* ══ 4. Sécurité ══ */
    .sec-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
    .sec { display: flex; flex-direction: column; padding: 16px; border: 1px solid var(--border-subtle); border-radius: 11px; background: var(--surface-subtle); }
    .sec:hover { border-color: var(--accent-primary); background: var(--surface-base); }
    .sec-ico {
      width: 32px; height: 32px; border-radius: 8px; margin-bottom: 11px;
      display: grid; place-items: center;
      background: var(--accent-primary-soft); color: var(--accent-primary);
    }
    .sec-ico svg { width: 16px; height: 16px; }
    .sec-t { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
    .sec-d { font-size: 12.5px; color: var(--text-tertiary); margin: 4px 0 14px; line-height: 1.45; flex: 1; }

    /* ══ 6. Zone dangereuse ══ */
    .danger { border: 1px solid #fca5a5; background: #fef6f6; border-radius: 12px; padding: 16px 20px 18px; }
    .danger-t { font-size: 13.5px; font-weight: 700; color: #b91c1c; margin: 0 0 4px; }
    .danger-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 0; border-bottom: 1px solid #fadcdc; flex-wrap: wrap; }
    .danger-row:last-child { padding-bottom: 0; border-bottom: none; }
    .dr-t { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .dr-d { font-size: 12.5px; color: var(--text-secondary); margin-top: 2px; }

    /* ══ Confirmation ══ */
    .modal-ov { position: fixed; inset: 0; background: rgba(0,0,0,0.42); z-index: 9998; }
    .modal {
      position: fixed; z-index: 9999; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(440px, calc(100vw - 32px));
      background: var(--surface-base); border: 1px solid var(--border-subtle);
      border-radius: 14px; padding: 22px 24px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.24);
    }
    .modal h3 { font-size: 16px; font-weight: 700; margin: 0 0 8px; color: var(--text-primary); }
    .modal p { font-size: 13.5px; color: var(--text-secondary); line-height: 1.55; margin: 0 0 20px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

    /* ══ Toast ══ */
    .toast {
      position: fixed; bottom: 24px; right: 24px; z-index: 10000;
      display: flex; align-items: center; gap: 10px;
      background: #18181b; color: #fff;
      padding: 11px 16px; border-radius: 10px;
      font-size: 13px; font-weight: 500;
      box-shadow: 0 12px 32px rgba(0,0,0,0.22);
      animation: toast-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes toast-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .toast svg { width: 16px; height: 16px; color: #4ade80; }
    .toast.t-error svg { color: #f87171; }

    /* ══════════ Mode sombre ══════════
       Seules les couleurs figées en dur (vert du badge, rouges de la zone
       dangereuse) ont besoin d'une variante : le reste passe par les tokens. */
    :host-context([data-theme="dark"]) {
      .badge-ok { background: rgba(16, 185, 129, 0.16); color: #6ee7b7; border-color: rgba(110, 231, 183, 0.28); }

      .danger { background: rgba(220, 38, 38, 0.07); border-color: rgba(248, 113, 113, 0.30); }
      .danger-t { color: #f87171; }
      .danger-row { border-bottom-color: rgba(248, 113, 113, 0.16); }

      .btn-danger-out { color: #fca5a5; border-color: rgba(248, 113, 113, 0.38); }
      .btn-danger-out:hover { background: rgba(220, 38, 38, 0.14); border-color: #f87171; color: #fecaca; }

      .toast { background: #26262a; border: 1px solid var(--border-default); }
    }
  `]
})
export class ProfileComponent implements OnInit {
  private apiService = inject(ApiService);
  private keycloak = inject(KeycloakService);
  private notifs = inject(NotifsService);
  private currentUser = inject(CurrentUserService);
  private http = inject(HttpClient);

  @ViewChild('photoInput') private photoInput?: ElementRef<HTMLInputElement>;

  me: any = null;
  form: any = null;
  editing = false;
  saving = false;
  toast: { message: string; type: 'success' | 'error' } | null = null;

  /** Sécurité : renseignée par le compte Keycloak quand il est joignable. */
  twoFactor: boolean | null = null;
  passwordUpdatedAt: Date | null = null;
  activeSessions: number | null = null;

  /** Photo : côté largeur maximale après redimensionnement, en pixels. */
  private static readonly PHOTO_SIZE = 320;
  uploadingPhoto = false;

  confirming: DangerAction | null = null;
  dangerBusy = false;

  get initials(): string {
    if (!this.me) return '?';
    return ((this.me.firstName || 'U')[0] + (this.me.lastName || '?')[0]).toUpperCase();
  }

  get fullName(): string {
    const n = `${this.me?.firstName || ''} ${this.me?.lastName || ''}`.trim();
    return n || this.me?.email || 'Utilisateur';
  }

  /** Photo affichée dans le bandeau (celle en cours d'édition si le formulaire est ouvert). */
  get photoPreview(): string | null {
    return (this.editing ? this.form?.photoUrl : this.me?.photoUrl) || null;
  }

  /** Dernière authentification, lue dans le jeton (claim `auth_time`). */
  get lastLogin(): Date | null {
    const t: any = this.keycloak.getKeycloakInstance()?.tokenParsed;
    return t?.auth_time ? new Date(t.auth_time * 1000) : null;
  }

  get passwordHint(): string {
    return this.passwordUpdatedAt
      ? `Dernière modification : ${this.passwordUpdatedAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : 'Modifiable à tout moment depuis votre compte.';
  }

  get sessionsHint(): string {
    if (this.activeSessions === null) return 'Consultez les appareils connectés à votre compte.';
    return `${this.activeSessions} session${this.activeSessions > 1 ? 's' : ''} actuellement active${this.activeSessions > 1 ? 's' : ''}.`;
  }

  // ─── Rôle ───
  get role(): string {
    // On privilégie le rôle effectif (le plus élevé) du token, cohérent avec la nav/gardes.
    try {
      const r = primaryRole(this.keycloak.getUserRoles());
      if (r !== 'USER') return r;
    } catch {}
    return (this.me?.role || 'USER').toUpperCase();
  }
  get roleLabel(): string {
    return ({ ADMIN: 'Administrateur', ORGANISATEUR: 'Organisateur', PARTICIPANT: 'Participant' } as any)[this.role] || 'Collaborateur';
  }
  ngOnInit() {
    this.apiService.getMe().subscribe({
      next: u => { this.me = u; this.currentUser.setPhoto(u?.photoUrl); },
      error: () => this.showToast('Erreur lors du chargement du profil', 'error')
    });
    this.loadSecurity();
  }

  // ─── Photo de profil ───

  /** Ouvre le sélecteur de fichiers du système. */
  pickPhoto(): void {
    this.photoInput?.nativeElement.click();
  }

  /**
   * Lit l'image choisie sur le poste, la redimensionne dans un canvas puis la
   * stocke en data URL. Le champ `photoUrl` est en TEXT côté base : pas besoin
   * d'un service de stockage de fichiers pour un avatar de cette taille.
   */
  onPhotoSelected(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';                              // permet de re-choisir le même fichier
    if (!file) return;
    if (!file.type.startsWith('image/')) { this.showToast('Choisissez un fichier image', 'error'); return; }
    if (file.size > 8 * 1024 * 1024) { this.showToast('Image trop lourde (8 Mo maximum)', 'error'); return; }

    this.uploadingPhoto = true;
    this.resizeToDataUrl(file)
      .then(dataUrl => {
        if (this.editing && this.form) {
          // En édition : la photo part avec le reste du formulaire.
          this.form.photoUrl = dataUrl;
          this.uploadingPhoto = false;
          this.showToast('Photo prête, enregistrez pour valider', 'success');
          return;
        }
        // Hors édition : on enregistre immédiatement.
        this.apiService.updateMyProfile({ ...this.me, photoUrl: dataUrl }).subscribe({
          next: updated => {
            this.me = updated;
            this.currentUser.setPhoto(updated?.photoUrl);
            this.uploadingPhoto = false;
            this.showToast('Photo de profil mise à jour', 'success');
          },
          error: () => { this.uploadingPhoto = false; this.showToast('Erreur lors de l\'envoi de la photo', 'error'); }
        });
      })
      .catch(() => { this.uploadingPhoto = false; this.showToast('Image illisible', 'error'); });
  }

  /** Redimensionne l'image (recadrage centré carré) et renvoie une data URL JPEG. */
  private resizeToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          const size = ProfileComponent.PHOTO_SIZE;
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;
          const canvas = document.createElement('canvas');
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas')); return; }
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } catch (e) {
          reject(e);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      img.src = url;
    });
  }

  // ─── Sécurité (compte Keycloak) ───

  /** Base de l'API compte du realm, dérivée de l'instance Keycloak. */
  private get accountApi(): string | null {
    const kc: any = this.keycloak.getKeycloakInstance();
    if (!kc?.authServerUrl || !kc?.realm) return null;
    return `${String(kc.authServerUrl).replace(/\/$/, '')}/realms/${kc.realm}/account`;
  }

  /**
   * Renseigne l'état de sécurité depuis le compte Keycloak.
   * L'API peut être inaccessible (CORS, audience du jeton) : dans ce cas les
   * indicateurs restent « non renseignés » plutôt que d'afficher une valeur
   * inventée, et les boutons continuent d'ouvrir la console du compte.
   */
  private loadSecurity(): void {
    const base = this.accountApi;
    const token = this.keycloak.getKeycloakInstance()?.token;
    if (!base || !token) return;
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}`, Accept: 'application/json' });

    this.http.get<any[]>(`${base}/credentials`, { headers }).subscribe({
      next: containers => {
        const list = containers || [];
        const otp = list.find(c => (c?.type || '').toLowerCase() === 'otp');
        this.twoFactor = otp ? (otp.userCredentialMetadatas || []).length > 0 : false;

        const pwd = list.find(c => (c?.type || '').toLowerCase() === 'password');
        const created = pwd?.userCredentialMetadatas?.[0]?.credential?.createdDate;
        this.passwordUpdatedAt = created ? new Date(created) : null;
      },
      error: () => { /* état inconnu : on n'affiche rien plutôt qu'une valeur fausse */ }
    });

    this.http.get<any[]>(`${base}/sessions`, { headers }).subscribe({
      next: s => this.activeSessions = (s || []).length,
      error: () => {}
    });
  }

  /** Ouvre le flux Keycloak de changement de mot de passe. */
  changePassword(): void {
    const kc: any = this.keycloak.getKeycloakInstance();
    if (!kc) return;
    kc.login({ action: 'UPDATE_PASSWORD', redirectUri: window.location.href });
  }

  /** Ouvre la console du compte Keycloak sur la section demandée. */
  openAccount(fragment = ''): void {
    const kc: any = this.keycloak.getKeycloakInstance();
    const url = kc?.createAccountUrl?.();
    if (!url) { this.showToast('Console du compte indisponible', 'error'); return; }
    window.open(url + fragment, '_blank', 'noopener');
  }

  // ─── Zone dangereuse ───
  runDanger(): void {
    if (!this.confirming) return;
    const action = this.confirming;
    this.dangerBusy = true;
    const call = action === 'disable'
      ? this.apiService.disableMyAccount()
      : this.apiService.logoutAllDevices();

    call.subscribe({
      next: () => {
        this.dangerBusy = false;
        this.confirming = null;
        // Les deux actions ferment la session courante : on rend la main à Keycloak.
        this.notifs.reset();
        this.keycloak.logout(window.location.origin);
      },
      error: () => {
        this.dangerBusy = false;
        this.showToast(action === 'disable' ? 'Désactivation impossible' : 'Déconnexion impossible', 'error');
      }
    });
  }

  startEdit() {
    this.editing = true;
    this.form = { ...this.me };
  }

  cancelEdit() {
    this.editing = false;
    this.form = null;
  }

  save() {
    if (!this.form?.firstName) {
      this.showToast('Le prénom est requis', 'error');
      return;
    }
    this.saving = true;
    // Set profileComplete if user filled main fields
    this.form.profileComplete = !!(this.form.firstName && this.form.email && this.form.phoneNumber);
    this.apiService.updateMyProfile(this.form).subscribe({
      next: updated => {
        this.me = updated;
        this.currentUser.setPhoto(updated?.photoUrl);
        this.editing = false;
        this.saving = false;
        this.showToast('Profil mis à jour !', 'success');
      },
      error: () => {
        this.saving = false;
        this.showToast('Erreur lors de la sauvegarde', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toast = { message, type };
    setTimeout(() => this.toast = null, 3500);
  }
}
