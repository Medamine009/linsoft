import { Component, OnInit, OnDestroy, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-splash',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="splash" [class.reveal]="phase >= 2" [class.exit]="isExiting" (click)="dismiss()">

      <!-- Filet rouge corporate en haut -->
      <span class="topbar"></span>

      <div class="content">
        <span class="eyebrow">Plateforme interne</span>

        <img class="splash-logo" src="assets/logos/linsoft.jpg" alt="LINSOFT" />

        <span class="rule"></span>
        <p class="subtitle">Learning Center · Formations &amp; certifications IT</p>

        <!-- Présentation (phase 2) -->
        <div class="reveal-block">
          <div class="credit">
            <span class="c-by">Développé par</span>
            <span class="c-name">Med Amine Khadhraoui</span>
          </div>

          <button class="enter" (click)="dismiss(); $event.stopPropagation()">
            Accéder à la plateforme
            <svg viewBox="0 0 24 8" fill="none"><path d="M0 4h21M18 1l3 3-3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./splash.component.scss']
})
export class SplashComponent implements OnInit, OnDestroy {
  @Output() done = new EventEmitter<void>();

  phase = 1;
  isExiting = false;
  private timer: any;

  ngOnInit() {
    this.timer = setTimeout(() => this.phase = 2, 1400);
  }

  ngOnDestroy() { clearTimeout(this.timer); }

  dismiss() {
    if (this.isExiting) return;
    this.isExiting = true;
    setTimeout(() => this.done.emit(), 600);
  }
}
