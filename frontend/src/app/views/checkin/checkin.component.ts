import { Component, OnInit, OnDestroy, inject, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Html5Qrcode } from 'html5-qrcode';
import { ApiService } from '../../services/api.service';

type ScanFeed = { name: string; event: string; result: string; time: Date };

@Component({
  selector: 'app-checkin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="ci">
      <header class="ci-head">
        <div>
          <h1 class="ci-h1">Check-in — Jour J</h1>
          <p class="ci-sub">Scannez les QR codes à l'entrée pour valider les billets en temps réel.</p>
        </div>
        <div class="ci-event-pick">
          <label>Événement</label>
          <select [(ngModel)]="selectedEventId" (ngModelChange)="onSelectEvent()">
            <option value="">— Choisir un événement —</option>
            <option *ngFor="let e of myEvents" [value]="e.id">{{ e.title }}</option>
          </select>
        </div>
      </header>

      <!-- KPIs -->
      <div class="ci-kpis" *ngIf="selectedEventId">
        <div class="ci-kpi">
          <div class="ci-kpi-val">{{ presentCount }}<span class="ci-kpi-tot">/ {{ confirmedCount }}</span></div>
          <div class="ci-kpi-lbl">Présents</div>
          <div class="ci-kpi-bar"><span [style.width.%]="confirmedCount ? (presentCount / confirmedCount) * 100 : 0"></span></div>
        </div>
        <div class="ci-kpi">
          <div class="ci-kpi-val">{{ confirmedCount - presentCount }}</div>
          <div class="ci-kpi-lbl">Attendus</div>
        </div>
        <div class="ci-kpi">
          <div class="ci-kpi-val">{{ rate }}%</div>
          <div class="ci-kpi-lbl">Taux de présence</div>
        </div>
      </div>

      <div class="ci-grid" *ngIf="selectedEventId">
        <!-- ─── SCANNER ─── -->
        <section class="ci-panel">
          <div class="ci-panel-head">
            <h3>Scanner QR</h3>
            <button *ngIf="!scanning" class="ci-btn ci-btn-primary" (click)="startScan()">▶ Démarrer la caméra</button>
            <button *ngIf="scanning" class="ci-btn ci-btn-ghost" (click)="stopScan()">⏹ Arrêter</button>
          </div>

          <div class="ci-scanner">
            <div id="qr-reader" class="ci-reader"></div>
            <div *ngIf="!scanning" class="ci-reader-idle">
              <svg viewBox="0 0 64 64" fill="none">
                <path d="M8 20V12a4 4 0 0 1 4-4h8M44 8h8a4 4 0 0 1 4 4v8M56 44v8a4 4 0 0 1-4 4h-8M20 56h-8a4 4 0 0 1-4-4v-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                <rect x="22" y="22" width="20" height="20" rx="2" stroke="currentColor" stroke-width="2.5"/>
              </svg>
              <p>Cliquez sur « Démarrer la caméra » puis présentez un billet</p>
            </div>
          </div>

          <!-- Résultat du dernier scan -->
          <div *ngIf="lastResult" class="ci-result" [ngClass]="'res-' + lastResult.result.toLowerCase()">
            <div class="ci-result-icon">
              <span *ngIf="lastResult.result === 'OK'">✓</span>
              <span *ngIf="lastResult.result === 'ALREADY'">⚠</span>
              <span *ngIf="lastResult.result === 'INVALID' || lastResult.result === 'NOT_FOUND'">✕</span>
            </div>
            <div>
              <div class="ci-result-title">
                {{ lastResult.result === 'OK' ? 'Billet validé !' :
                   lastResult.result === 'ALREADY' ? 'Déjà scanné' :
                   lastResult.result === 'INVALID' ? 'Billet annulé / invalide' : 'Billet introuvable' }}
              </div>
              <div class="ci-result-name">{{ lastResult.name }}</div>
            </div>
          </div>

          <!-- Feed des derniers scans -->
          <div class="ci-feed" *ngIf="feed.length">
            <div class="ci-feed-title">Derniers scans</div>
            <div class="ci-feed-row" *ngFor="let f of feed" [ngClass]="'fr-' + f.result.toLowerCase()">
              <span class="ci-feed-dot"></span>
              <span class="ci-feed-name">{{ f.name }}</span>
              <span class="ci-feed-time">{{ f.time | date:'HH:mm:ss' }}</span>
            </div>
          </div>
        </section>

        <!-- ─── LISTE DE PRÉSENCE ─── -->
        <section class="ci-panel">
          <div class="ci-panel-head">
            <h3>Liste de présence <span class="ci-count">{{ filteredRegs.length }}</span></h3>
            <button class="ci-btn ci-btn-ghost" (click)="exportCsv()" [disabled]="!registrations.length">⬇ Export CSV</button>
          </div>

          <div class="ci-search">
            <input placeholder="Rechercher un participant…" [(ngModel)]="search">
          </div>

          <div *ngIf="loadingRegs" class="ci-empty">Chargement…</div>
          <div *ngIf="!loadingRegs && filteredRegs.length === 0" class="ci-empty">Aucun inscrit pour cet événement.</div>

          <div class="ci-list" *ngIf="!loadingRegs">
            <div class="ci-att" *ngFor="let r of filteredRegs" [class.is-present]="r.checkedIn" [class.is-cancelled]="r.status !== 'CONFIRMED'">
              <div class="ci-att-ava">{{ initials(r.attendeeName) }}</div>
              <div class="ci-att-info">
                <div class="ci-att-name">{{ r.attendeeName || 'Participant' }}</div>
                <div class="ci-att-meta">
                  <span *ngIf="r.status !== 'CONFIRMED'" class="ci-tag ci-tag-cancel">Annulé</span>
                  <span *ngIf="r.checkedIn" class="ci-tag ci-tag-present">Présent · {{ r.checkedInAt | date:'HH:mm' }}</span>
                  <span *ngIf="!r.checkedIn && r.status === 'CONFIRMED'" class="ci-tag ci-tag-wait">En attente</span>
                </div>
              </div>
              <button *ngIf="!r.checkedIn && r.status === 'CONFIRMED'" class="ci-att-btn ci-btn-primary" (click)="manualCheckIn(r)">Check-in</button>
              <button *ngIf="r.checkedIn" class="ci-att-btn ci-btn-undo" (click)="undo(r)">Annuler</button>
            </div>
          </div>
        </section>
      </div>

      <div *ngIf="!selectedEventId" class="ci-pick-empty">
        <svg viewBox="0 0 64 64" fill="none"><rect x="10" y="16" width="44" height="38" rx="4" stroke="currentColor" stroke-width="2.5"/><path d="M10 26h44M22 10v10M42 10v10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
        <p>Choisissez un événement pour démarrer le check-in.</p>
      </div>

      <div *ngIf="toast" class="ci-toast" [ngClass]="'t-' + toast.type">{{ toast.msg }}</div>
    </div>
  `,
  styles: [`
    .ci { font-family: 'Inter', system-ui, sans-serif; padding-bottom: 60px; color: var(--text-primary, #18181b); }
    .ci-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-bottom: 24px; flex-wrap: wrap; }
    .ci-h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 4px; }
    .ci-sub { font-size: 14px; color: var(--text-secondary, #71717a); margin: 0; }
    .ci-event-pick { display: flex; flex-direction: column; gap: 6px; }
    .ci-event-pick label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-tertiary, #a1a1aa); }
    .ci-event-pick select { padding: 9px 14px; border-radius: 10px; border: 1px solid var(--border-default, #e4e4e7); background: var(--surface-base, #fff); font-size: 14px; font-family: inherit; min-width: 240px; color: inherit; }

    .ci-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
    .ci-kpi { background: var(--surface-base, #fff); border: 1px solid var(--border-subtle, #f0f0f2); border-radius: 14px; padding: 18px 20px; }
    .ci-kpi-val { font-size: 30px; font-weight: 800; letter-spacing: -1px; }
    .ci-kpi-tot { font-size: 16px; font-weight: 600; color: var(--text-tertiary, #a1a1aa); margin-left: 4px; }
    .ci-kpi-lbl { font-size: 12px; color: var(--text-tertiary, #a1a1aa); text-transform: uppercase; letter-spacing: 0.6px; font-weight: 600; margin-top: 4px; }
    .ci-kpi-bar { height: 6px; background: var(--surface-muted, #f4f4f5); border-radius: 4px; margin-top: 10px; overflow: hidden; }
    .ci-kpi-bar span { display: block; height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 4px; transition: width 0.5s ease; }

    .ci-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 980px) { .ci-grid, .ci-kpis { grid-template-columns: 1fr; } }

    .ci-panel { background: var(--surface-base, #fff); border: 1px solid var(--border-subtle, #f0f0f2); border-radius: 16px; padding: 20px; }
    .ci-panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .ci-panel-head h3 { font-size: 15px; font-weight: 700; margin: 0; }
    .ci-count { font-size: 12px; color: var(--text-tertiary, #a1a1aa); font-weight: 500; margin-left: 6px; }

    .ci-btn { border: none; border-radius: 9px; padding: 8px 16px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s ease; }
    .ci-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ci-btn-primary { background: linear-gradient(135deg, var(--accent-primary), var(--accent-primary-hover)); color: #fff; }
    .ci-btn-primary:hover:not(:disabled) { filter: brightness(1.08); }
    .ci-btn-ghost { background: var(--surface-muted, #f4f4f5); color: var(--text-secondary, #52525b); }
    .ci-btn-ghost:hover:not(:disabled) { background: var(--surface-subtle, #e9e9ee); }
    .ci-btn-undo { background: #fef2f2; color: #b91c1c; }

    .ci-scanner { position: relative; border-radius: 14px; overflow: hidden; background: #0a0a0f; min-height: 280px; display: flex; align-items: center; justify-content: center; }
    .ci-reader { width: 100%; }
    .ci-reader-idle { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; color: rgba(255,255,255,0.5); text-align: center; padding: 20px; }
    .ci-reader-idle svg { width: 56px; height: 56px; }
    .ci-reader-idle p { font-size: 13px; margin: 0; max-width: 240px; }

    .ci-result { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 12px; margin-top: 16px; animation: pop 0.3s cubic-bezier(0.34,1.56,0.64,1); }
    @keyframes pop { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    .ci-result-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 800; color: #fff; flex-shrink: 0; }
    .ci-result-title { font-weight: 700; font-size: 15px; }
    .ci-result-name { font-size: 13px; opacity: 0.8; }
    .res-ok { background: #ecfdf5; color: #065f46; } .res-ok .ci-result-icon { background: #10b981; }
    .res-already { background: #fffbeb; color: #92400e; } .res-already .ci-result-icon { background: #f59e0b; }
    .res-invalid, .res-not_found { background: #fef2f2; color: #991b1b; } .res-invalid .ci-result-icon, .res-not_found .ci-result-icon { background: #ef4444; }

    .ci-feed { margin-top: 18px; }
    .ci-feed-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-tertiary, #a1a1aa); font-weight: 700; margin-bottom: 8px; }
    .ci-feed-row { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 13px; border-bottom: 1px solid var(--border-subtle, #f4f4f5); }
    .ci-feed-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .fr-ok .ci-feed-dot { background: #10b981; } .fr-already .ci-feed-dot { background: #f59e0b; } .fr-invalid .ci-feed-dot, .fr-not_found .ci-feed-dot { background: #ef4444; }
    .ci-feed-name { flex: 1; font-weight: 500; }
    .ci-feed-time { color: var(--text-tertiary, #a1a1aa); font-size: 12px; }

    .ci-search input { width: 100%; padding: 9px 14px; border-radius: 10px; border: 1px solid var(--border-default, #e4e4e7); font-size: 14px; font-family: inherit; margin-bottom: 14px; background: var(--surface-base,#fff); color: inherit; box-sizing: border-box; }
    .ci-empty { padding: 30px; text-align: center; color: var(--text-tertiary, #a1a1aa); font-size: 14px; }
    .ci-list { display: flex; flex-direction: column; gap: 8px; max-height: 480px; overflow-y: auto; }
    .ci-att { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 12px; background: var(--surface-subtle, #fafafa); border: 1px solid transparent; transition: all 0.15s ease; }
    .ci-att.is-present { background: #ecfdf5; border-color: #a7f3d0; }
    .ci-att.is-cancelled { opacity: 0.55; }
    .ci-att-ava { width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg,#e30613,#ff3341); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0; }
    .ci-att-info { flex: 1; min-width: 0; }
    .ci-att-name { font-weight: 600; font-size: 14px; }
    .ci-att-meta { margin-top: 3px; }
    .ci-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
    .ci-tag-present { background: #d1fae5; color: #065f46; }
    .ci-tag-wait { background: var(--surface-muted,#f4f4f5); color: var(--text-secondary,#71717a); }
    .ci-tag-cancel { background: #fee2e2; color: #991b1b; }
    .ci-att-btn { border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; flex-shrink: 0; }

    .ci-pick-empty { text-align: center; padding: 80px 20px; color: var(--text-tertiary, #a1a1aa); }
    .ci-pick-empty svg { width: 56px; height: 56px; margin-bottom: 16px; }
    .ci-pick-empty p { font-size: 15px; }

    .ci-toast { position: fixed; bottom: 24px; right: 24px; padding: 12px 18px; border-radius: 12px; color: #fff; font-size: 14px; font-weight: 600; box-shadow: 0 12px 32px rgba(0,0,0,0.2); z-index: 9999; animation: pop 0.3s ease; }
    .t-success { background: #059669; } .t-error { background: #dc2626; } .t-warn { background: #d97706; }
  `]
})
export class CheckinComponent implements OnInit, OnDestroy {
  private apiService = inject(ApiService);
  private zone = inject(NgZone);
  private cd = inject(ChangeDetectorRef);

  myEvents: any[] = [];
  selectedEventId = '';
  registrations: any[] = [];
  loadingRegs = false;
  search = '';

  scanning = false;
  private scanner: Html5Qrcode | null = null;
  private lastScanId = '';
  private lastScanAt = 0;

  lastResult: { result: string; name: string } | null = null;
  feed: ScanFeed[] = [];
  toast: { msg: string; type: 'success' | 'error' | 'warn' } | null = null;

  get filteredRegs(): any[] {
    const q = this.search.toLowerCase().trim();
    const list = q ? this.registrations.filter(r => (r.attendeeName || '').toLowerCase().includes(q)) : this.registrations;
    // Confirmés d'abord, présents en bas
    return [...list].sort((a, b) => (a.checkedIn === b.checkedIn ? 0 : a.checkedIn ? 1 : -1));
  }
  get confirmedCount(): number { return this.registrations.filter(r => r.status === 'CONFIRMED').length; }
  get presentCount(): number { return this.registrations.filter(r => r.checkedIn).length; }
  get rate(): number { return this.confirmedCount ? Math.round((this.presentCount / this.confirmedCount) * 100) : 0; }

  ngOnInit(): void {
    this.apiService.getMe().subscribe({
      next: me => {
        this.apiService.getAllEvents().subscribe({
          next: events => {
            const isAdmin = (me.role || '').toUpperCase() === 'ADMIN';
            const mine = [String(me.keycloakId), String(me.id)];
            this.myEvents = isAdmin ? events : events.filter((e: any) => mine.includes(String(e.organizerId)));
          }
        });
      }
    });
  }

  ngOnDestroy(): void { this.stopScan(); }

  onSelectEvent(): void {
    this.feed = []; this.lastResult = null;
    if (!this.selectedEventId) { this.registrations = []; return; }
    this.loadingRegs = true;
    this.apiService.getRegistrationsByEvent(this.selectedEventId).subscribe({
      next: regs => { this.registrations = regs || []; this.loadingRegs = false; },
      error: () => { this.loadingRegs = false; this.showToast('Erreur de chargement des inscrits', 'error'); }
    });
  }

  startScan(): void {
    this.scanning = true;
    setTimeout(() => {
      this.scanner = new Html5Qrcode('qr-reader');
      this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText: string) => this.zone.run(() => this.onDecoded(decodedText)),
        () => { /* ignore les frames sans QR */ }
      ).catch(() => {
        this.zone.run(() => {
          this.scanning = false;
          this.showToast("Impossible d'accéder à la caméra (autorisez-la dans le navigateur)", 'error');
        });
      });
    }, 100);
  }

  stopScan(): void {
    if (this.scanner) {
      this.scanner.stop().then(() => this.scanner?.clear()).catch(() => {});
      this.scanner = null;
    }
    this.scanning = false;
  }

  private onDecoded(text: string): void {
    const id = this.extractId(text);
    if (!id) return;
    const now = Date.now();
    // Anti double-scan : ignore le même billet pendant 3s
    if (id === this.lastScanId && now - this.lastScanAt < 3000) return;
    this.lastScanId = id; this.lastScanAt = now;
    this.doCheckIn(id);
  }

  private extractId(text: string): string | null {
    if (!text) return null;
    const m = text.match(/\/ticket\/([^/?#\s]+)/);
    if (m) return m[1];
    return text.trim() || null;
  }

  manualCheckIn(reg: any): void { this.doCheckIn(reg.id); }

  private doCheckIn(id: string): void {
    this.apiService.checkInRegistration(id).subscribe({
      next: res => {
        const name = res.attendeeName || 'Participant';
        this.lastResult = { result: res.result, name };
        this.feed.unshift({ name, event: res.eventTitle || '', result: res.result, time: new Date() });
        if (this.feed.length > 8) this.feed.pop();

        // Met à jour la liste locale si l'inscription en fait partie
        const reg = this.registrations.find(r => r.id === id);
        if (reg && res.result === 'OK') { reg.checkedIn = true; reg.checkedInAt = res.checkedInAt; }

        if (res.result === 'OK') this.showToast(`✓ ${name} — bienvenue !`, 'success');
        else if (res.result === 'ALREADY') this.showToast(`⚠ ${name} est déjà entré`, 'warn');
        else this.showToast('✕ Billet invalide ou annulé', 'error');
        this.cd.detectChanges();
      },
      error: () => { this.lastResult = { result: 'NOT_FOUND', name: '—' }; this.showToast('Billet introuvable', 'error'); }
    });
  }

  undo(reg: any): void {
    this.apiService.undoCheckIn(reg.id).subscribe({
      next: () => { reg.checkedIn = false; reg.checkedInAt = null; this.showToast('Check-in annulé', 'warn'); },
      error: () => this.showToast("Erreur lors de l'annulation", 'error')
    });
  }

  exportCsv(): void {
    const rows = [['Nom', 'Statut', 'Présent', 'Heure check-in']];
    for (const r of this.registrations) {
      rows.push([
        (r.attendeeName || 'Participant').replace(/;/g, ' '),
        r.status || '',
        r.checkedIn ? 'Oui' : 'Non',
        r.checkedInAt ? new Date(r.checkedInAt).toLocaleString('fr-FR') : ''
      ]);
    }
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ev = this.myEvents.find(e => e.id === this.selectedEventId);
    a.href = url; a.download = `presence-${(ev?.title || 'event').replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  initials(name: string): string {
    const p = (name || 'P').split(' ').filter(Boolean);
    return ((p[0]?.[0] || 'P') + (p[1]?.[0] || '')).toUpperCase();
  }

  private showToast(msg: string, type: 'success' | 'error' | 'warn'): void {
    this.toast = { msg, type };
    setTimeout(() => { this.toast = null; this.cd.detectChanges(); }, 3000);
  }
}
