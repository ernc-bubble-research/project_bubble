import { Component, input, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-info-tooltip',
  template: `
    <span
      class="tooltip-trigger"
      data-testid="info-tooltip"
      (mouseenter)="show.set(true)"
      (mouseleave)="show.set(false)"
      (focus)="show.set(true)"
      (blur)="show.set(false)"
      tabindex="0"
    >
      <lucide-icon name="info" [size]="14"></lucide-icon>
      @if (show()) {
        <span class="tooltip-popover">{{ text() }}</span>
      }
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    .tooltip-trigger {
      position: relative;
      display: inline-flex;
      align-items: center;
      color: var(--text-tertiary);
      cursor: help;
      outline: none;
    }
    .tooltip-popover {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 50%;
      transform: translateX(-50%);
      background: var(--slate-800);
      color: #fff;
      font-size: 12px;
      font-weight: 400;
      line-height: 1.4;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      white-space: normal;
      width: max-content;
      max-width: 280px;
      z-index: 100;
      box-shadow: var(--shadow-lg);
      pointer-events: none;
    }
  `],
})
export class InfoTooltipComponent {
  text = input.required<string>();
  show = signal(false);
}
