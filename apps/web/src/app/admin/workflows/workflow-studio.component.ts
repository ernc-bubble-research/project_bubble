import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
// ChainListComponent removed for V1 — deferred to Story 4-6 (post-deployment)
// TODO: re-enable in Story 4-6

type ActiveTab = 'templates';

@Component({
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TemplateListComponent],
  selector: 'app-workflow-studio',
  templateUrl: './workflow-studio.component.html',
  styleUrl: './workflow-studio.component.scss',
})
export class WorkflowStudioComponent {
  activeTab = signal<ActiveTab>('templates');

  setActiveTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }
}
