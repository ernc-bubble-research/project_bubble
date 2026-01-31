import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-stat-card',
  template: `
    <div class="stat-card">
      <span class="stat-icon" [style.color]="color">
        <lucide-icon [name]="icon" [size]="24"></lucide-icon>
      </span>
      <span class="stat-value">{{ value }}</span>
      <span class="stat-label">{{ label }}</span>
    </div>
  `,
  styles: [
    `
      .stat-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 24px;
        background: var(--bg-surface);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-sm);
      }
      .stat-icon {
        font-size: 24px;
        line-height: 1;
      }
      .stat-value {
        font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
        font-size: 28px;
        font-weight: 700;
        color: var(--text-main);
      }
      .stat-label {
        font-size: 13px;
        color: var(--text-secondary);
      }
    `,
  ],
})
export class StatCardComponent {
  @Input() icon = '';
  @Input() value: string | number = 0;
  @Input() label = '';
  @Input() color = 'var(--text-secondary)';
}
