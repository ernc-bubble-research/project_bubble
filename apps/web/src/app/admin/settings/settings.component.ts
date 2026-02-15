import { Component, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { LlmModelsListComponent } from './llm-models-list.component';
import { LlmModelFormDialogComponent } from './llm-model-form-dialog.component';
import { ProviderConfigListComponent } from './provider-config-list.component';
import { ProviderConfigFormDialogComponent } from './provider-config-form-dialog.component';
import { ProviderTypeService } from '../../core/services/provider-type.service';
import type { LlmModel } from '../../core/services/llm-model.service';
import type { LlmProviderConfig } from '../../core/services/llm-provider.service';

type SettingsTab = 'llm-models' | 'providers' | 'system';

@Component({
  standalone: true,
  imports: [
    LucideAngularModule,
    LlmModelsListComponent,
    LlmModelFormDialogComponent,
    ProviderConfigListComponent,
    ProviderConfigFormDialogComponent,
  ],
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly providerTypeService = inject(ProviderTypeService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild(LlmModelsListComponent) modelListComponent?: LlmModelsListComponent;
  @ViewChild(ProviderConfigListComponent) providerListComponent?: ProviderConfigListComponent;

  constructor() {
    // Eager-load provider types once in the parent — all child components
    // (list + form dialogs) consume the cached types signal.
    this.providerTypeService
      .getProviderTypes()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  activeTab = signal<SettingsTab>('llm-models');

  // LLM Models dialog state
  modelDialogOpen = signal(false);
  editingModel = signal<LlmModel | null>(null);

  // Provider Config dialog state
  providerDialogOpen = signal(false);
  editingProvider = signal<LlmProviderConfig | null>(null);

  setTab(tab: SettingsTab): void {
    if (tab !== 'system') {
      this.activeTab.set(tab);
    }
  }

  // --- LLM Models ---
  openAddModelDialog(): void {
    this.editingModel.set(null);
    this.modelDialogOpen.set(true);
  }

  openEditModelDialog(model: LlmModel): void {
    this.editingModel.set(model);
    this.modelDialogOpen.set(true);
  }

  closeModelDialog(): void {
    this.modelDialogOpen.set(false);
    this.editingModel.set(null);
  }

  onModelSaved(): void {
    this.closeModelDialog();
    this.modelListComponent?.loadModels();
  }

  // --- Provider Configs ---
  openAddProviderDialog(): void {
    this.editingProvider.set(null);
    this.providerDialogOpen.set(true);
  }

  openEditProviderDialog(config: LlmProviderConfig): void {
    this.editingProvider.set(config);
    this.providerDialogOpen.set(true);
  }

  closeProviderDialog(): void {
    this.providerDialogOpen.set(false);
    this.editingProvider.set(null);
  }

  onProviderSaved(): void {
    this.closeProviderDialog();
    this.providerListComponent?.loadConfigs();
  }
}
