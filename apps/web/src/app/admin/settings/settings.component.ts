import { Component, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  activeTab = signal<'llm-models' | 'system'>('llm-models');

  setTab(tab: 'llm-models' | 'system'): void {
    if (tab !== 'system') {
      this.activeTab.set(tab);
    }
  }
}
