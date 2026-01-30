import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  standalone: true,
  imports: [NgClass],
  selector: 'app-status-badge',
  template: `
    <span class="badge" [ngClass]="'badge-' + status">
      {{ status }}
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-block;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        line-height: 1;
      }
      .badge-active {
        background: var(--success-bg);
        color: var(--success-text);
        border: 1px solid #bbf7d0;
      }
      .badge-suspended {
        background: var(--danger-bg);
        color: var(--danger-text);
        border: 1px solid #fecaca;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input() status: 'active' | 'suspended' = 'active';
}
