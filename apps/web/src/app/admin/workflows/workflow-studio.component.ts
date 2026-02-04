import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
import { ChainListComponent } from './chain-list.component';

type ActiveTab = 'templates' | 'chains';

@Component({
  standalone: true,
  imports: [CommonModule, LucideAngularModule, TemplateListComponent, ChainListComponent],
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
