import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface Msg { role: 'user' | 'assistant'; content: string; }

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Bouton flottant -->
    <button class="cb-fab" [class.hidden]="open" (click)="toggle()" title="Assistant IA LINSOFT" aria-label="Ouvrir l'assistant">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3C7 3 3 6.4 3 10.6c0 2.3 1.2 4.3 3.1 5.7L5.4 20l3.9-1.7c.85.2 1.75.3 2.7.3 5 0 9-3.4 9-7.6S17 3 12 3Z"
              stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="8.5" cy="10.6" r="1" fill="currentColor"/>
        <circle cx="12" cy="10.6" r="1" fill="currentColor"/>
        <circle cx="15.5" cy="10.6" r="1" fill="currentColor"/>
      </svg>
    </button>

    <!-- Panneau -->
    <section class="cb-panel" [class.open]="open" role="dialog" aria-label="Assistant IA">
      <header class="cb-head">
        <div class="cb-head-l">
          <span class="cb-avatar">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2v3M5 9a7 7 0 0 1 14 0v4a7 7 0 0 1-14 0V9Z" stroke="#fff" stroke-width="1.6"/><circle cx="9" cy="11" r="1" fill="#fff"/><circle cx="15" cy="11" r="1" fill="#fff"/></svg>
          </span>
          <div>
            <div class="cb-title">Assistant LINSOFT</div>
            <div class="cb-sub"><span class="cb-dot"></span>IA · en ligne</div>
          </div>
        </div>
        <button class="cb-x" (click)="toggle()" aria-label="Fermer">
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
      </header>

      <div class="cb-body" #body>
        <div class="cb-msg assistant">
          <div class="cb-bubble">Bonjour 👋 Je suis l'assistant de LINSOFT Learning Center. Posez-moi une question sur les formations, les prérequis ou l'inscription.</div>
        </div>
        <div class="cb-msg" *ngFor="let m of messages" [class.user]="m.role==='user'" [class.assistant]="m.role==='assistant'">
          <div class="cb-bubble">{{ m.content }}</div>
        </div>
        <div class="cb-msg assistant" *ngIf="loading">
          <div class="cb-bubble cb-typing"><span></span><span></span><span></span></div>
        </div>
      </div>

      <div class="cb-suggests" *ngIf="messages.length === 0 && !loading">
        <button *ngFor="let s of suggestions" (click)="send(s)">{{ s }}</button>
      </div>

      <form class="cb-input" (ngSubmit)="send()">
        <input [(ngModel)]="input" name="q" autocomplete="off" placeholder="Écrivez votre message…" [disabled]="loading" />
        <button type="submit" [disabled]="loading || !input.trim()" aria-label="Envoyer">
          <svg viewBox="0 0 20 20" fill="none"><path d="M3 10l14-6-6 14-2.5-5.5L3 10Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </form>
    </section>
  `,
  styles: [`
    :host { --cb-accent:#e30613; --cb-accent2:#bd0410; }

    .cb-fab {
      position: fixed; right: 24px; bottom: 24px; z-index: 1200;
      width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, var(--cb-accent), var(--cb-accent2)); color: #fff;
      box-shadow: 0 10px 30px rgba(227, 6, 19,.35); display: grid; place-items: center;
      transition: transform .18s ease, opacity .18s ease;
    }
    .cb-fab svg { width: 26px; height: 26px; }
    .cb-fab:hover { transform: translateY(-2px) scale(1.04); }
    .cb-fab.hidden { opacity: 0; pointer-events: none; transform: scale(.6); }

    .cb-panel {
      position: fixed; right: 24px; bottom: 24px; z-index: 1201;
      width: 370px; max-width: calc(100vw - 32px); height: 560px; max-height: calc(100vh - 48px);
      background: #fff; border: 1px solid #ececef; border-radius: 18px; overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 24px 60px rgba(0,0,0,.18);
      opacity: 0; transform: translateY(16px) scale(.98); pointer-events: none;
      transition: opacity .2s ease, transform .2s ease;
    }
    .cb-panel.open { opacity: 1; transform: none; pointer-events: auto; }

    .cb-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; color: #fff;
      background: linear-gradient(135deg, var(--cb-accent), var(--cb-accent2));
    }
    .cb-head-l { display: flex; align-items: center; gap: 10px; }
    .cb-avatar { width: 36px; height: 36px; border-radius: 50%; background: rgba(255,255,255,.18);
      display: grid; place-items: center; }
    .cb-avatar svg { width: 20px; height: 20px; }
    .cb-title { font-weight: 700; font-size: 14px; letter-spacing: -.2px; }
    .cb-sub { font-size: 11px; opacity: .9; display: flex; align-items: center; gap: 5px; }
    .cb-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; display: inline-block; }
    .cb-x { background: rgba(255,255,255,.15); border: none; color: #fff; width: 28px; height: 28px;
      border-radius: 8px; cursor: pointer; display: grid; place-items: center; }
    .cb-x svg { width: 15px; height: 15px; }
    .cb-x:hover { background: rgba(255,255,255,.28); }

    .cb-body { flex: 1; overflow-y: auto; padding: 16px; background: #fafafa;
      display: flex; flex-direction: column; gap: 10px; }
    .cb-msg { display: flex; }
    .cb-msg.user { justify-content: flex-end; }
    .cb-bubble { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: 13.5px;
      line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .cb-msg.assistant .cb-bubble { background: #fff; border: 1px solid #ececef; color: #1a1a1a;
      border-bottom-left-radius: 5px; }
    .cb-msg.user .cb-bubble { background: linear-gradient(135deg, var(--cb-accent), var(--cb-accent2));
      color: #fff; border-bottom-right-radius: 5px; }

    .cb-typing { display: flex; gap: 4px; align-items: center; }
    .cb-typing span { width: 7px; height: 7px; border-radius: 50%; background: #c9c9cf;
      animation: cb-b 1s infinite ease-in-out; }
    .cb-typing span:nth-child(2) { animation-delay: .15s; }
    .cb-typing span:nth-child(3) { animation-delay: .3s; }
    @keyframes cb-b { 0%,60%,100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }

    .cb-suggests { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 10px; background: #fafafa; }
    .cb-suggests button { border: 1px solid #e6e6ea; background: #fff; color: #444; border-radius: 999px;
      padding: 6px 11px; font-size: 12px; cursor: pointer; }
    .cb-suggests button:hover { border-color: var(--cb-accent); color: var(--cb-accent); }

    .cb-input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #ececef; background: #fff; }
    .cb-input input { flex: 1; border: 1px solid #e2e2e7; border-radius: 12px; padding: 10px 12px;
      font-size: 13.5px; outline: none; }
    .cb-input input:focus { border-color: var(--cb-accent); }
    .cb-input button { border: none; width: 40px; border-radius: 12px; cursor: pointer; color: #fff;
      background: linear-gradient(135deg, var(--cb-accent), var(--cb-accent2)); display: grid; place-items: center; }
    .cb-input button svg { width: 18px; height: 18px; }
    .cb-input button:disabled { opacity: .5; cursor: not-allowed; }

    /* Thème sombre */
    :host-context([data-theme="dark"]) .cb-panel { background:#1b1b1f; border-color:#2a2a30; }
    :host-context([data-theme="dark"]) .cb-body { background:#141417; }
    :host-context([data-theme="dark"]) .cb-msg.assistant .cb-bubble { background:#232329; border-color:#2f2f37; color:#ededf0; }
    :host-context([data-theme="dark"]) .cb-input { background:#1b1b1f; border-color:#2a2a30; }
    :host-context([data-theme="dark"]) .cb-input input { background:#232329; border-color:#33333b; color:#ededf0; }
    :host-context([data-theme="dark"]) .cb-suggests, :host-context([data-theme="dark"]) .cb-suggests button { background:transparent; }
    :host-context([data-theme="dark"]) .cb-suggests button { background:#232329; border-color:#33333b; color:#c9c9d1; }
  `]
})
export class ChatbotComponent {
  private api = inject(ApiService);
  @ViewChild('body') bodyRef?: ElementRef<HTMLDivElement>;

  open = false;
  input = '';
  loading = false;
  messages: Msg[] = [];

  suggestions = [
    'Quelles formations Cloud sont dispo ?',
    'Comment m\'inscrire à une session ?',
    'Y a-t-il des formations pour débutants ?'
  ];

  toggle() {
    this.open = !this.open;
    if (this.open) this.scrollSoon();
  }

  send(preset?: string) {
    const text = (preset ?? this.input).trim();
    if (!text || this.loading) return;

    // Historique = tours réels déjà échangés (on retire un éventuel message d'accueil en tête)
    const history = this.messages.map(m => ({ role: m.role, content: m.content }));
    while (history.length && history[0].role !== 'user') history.shift();

    this.messages.push({ role: 'user', content: text });
    this.input = '';
    this.loading = true;
    this.scrollSoon();

    this.api.chatWithAi(text, history).subscribe({
      next: (r) => {
        this.messages.push({ role: 'assistant', content: r?.reply?.trim() || '…' });
        this.loading = false;
        this.scrollSoon();
      },
      error: () => {
        this.messages.push({ role: 'assistant', content: "L'assistant est momentanément indisponible. Réessayez dans un instant." });
        this.loading = false;
        this.scrollSoon();
      }
    });
  }

  private scrollSoon() {
    setTimeout(() => {
      const el = this.bodyRef?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    }, 60);
  }
}
