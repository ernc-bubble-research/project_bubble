import { Component, signal, ViewChild } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { LlmModelsListComponent } from './llm-models-list.component';
import { LlmModelFormDialogComponent } from './llm-model-form-dialog.component';
import type { LlmModel } from '../../core/services/llm-model.service';

@Component({
  standalone: true,
  imports: [LucideAngularModule, LlmModelsListComponent, LlmModelFormDialogComponent],
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  @ViewChild(LlmModelsListComponent) listComponent?: LlmModelsListComponent;

  activeTab = signal<'llm-models' | 'system'>('llm-models');
  dialogOpen = signal(false);
  editingModel = signal<LlmModel | null>(null);

  setTab(tab: 'llm-models' | 'system'): void {
    if (tab !== 'system') {
      this.activeTab.set(tab);
    }
  }

  openAddDialog(): void {
    this.editingModel.set(null);
    this.dialogOpen.set(true);
  }

  openEditDialog(model: LlmModel): void {
    this.editingModel.set(model);
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    this.dialogOpen.set(false);
    this.editingModel.set(null);
  }

  onModelSaved(): void {
    this.closeDialog();
    // Refresh the list
    this.listComponent?.loadModels();
  }
}
