import { Component, DestroyRef, inject, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { LlmModelsListComponent, type DeactivateModelRequest, type DeactivateBulkRequest } from './llm-models-list.component';
import { LlmModelFormDialogComponent } from './llm-model-form-dialog.component';
import { ProviderConfigListComponent, type DeactivateProviderRequest } from './provider-config-list.component';
import { ProviderConfigFormDialogComponent } from './provider-config-form-dialog.component';
import { ModelDeactivateDialogComponent, type DeactivateDialogInput } from './model-deactivate-dialog.component';
import { ProviderTypeService } from '../../core/services/provider-type.service';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import { LlmProviderService, type LlmProviderConfig } from '../../core/services/llm-provider.service';

type SettingsTab = 'llm-models' | 'providers' | 'system';

@Component({
  standalone: true,
  imports: [
    LucideAngularModule,
    LlmModelsListComponent,
    LlmModelFormDialogComponent,
    ProviderConfigListComponent,
    ProviderConfigFormDialogComponent,
    ModelDeactivateDialogComponent,
  ],
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  private readonly providerTypeService = inject(ProviderTypeService);
  private readonly llmModelService = inject(LlmModelService);
  private readonly llmProviderService = inject(LlmProviderService);
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

  // Deactivation dialog state
  deactivateDialogOpen = signal(false);
  deactivateDialogInput = signal<DeactivateDialogInput | null>(null);
  deactivateError = signal<string | null>(null);
  private deactivatingModelIds = signal<string[]>([]);
  private deactivatingProviderConfigId = signal<string | null>(null);

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

  // --- Deactivation Dialog ---
  onDeactivateRequested(request: DeactivateModelRequest): void {
    this.deactivatingModelIds.set([request.modelId]);
    this.deactivatingProviderConfigId.set(null);
    this.deactivateDialogInput.set({
      modelIds: [request.modelId],
      allModels: request.allModels,
      context: 'model',
    });
    this.deactivateDialogOpen.set(true);
  }

  onDeactivateBulkRequested(request: DeactivateBulkRequest): void {
    this.deactivatingModelIds.set(request.modelIds);
    this.deactivatingProviderConfigId.set(null);
    this.deactivateDialogInput.set({
      modelIds: request.modelIds,
      allModels: request.allModels,
      context: 'provider',
      providerName: request.providerKey,
    });
    this.deactivateDialogOpen.set(true);
  }

  onProviderDeactivateRequested(request: DeactivateProviderRequest): void {
    // Fetch all models to find which belong to this provider
    this.llmModelService
      .getAllModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (allModels) => {
          const providerModelIds = allModels
            .filter((m) => m.providerKey === request.providerKey && m.isActive)
            .map((m) => m.id);

          this.deactivatingModelIds.set(providerModelIds);
          this.deactivatingProviderConfigId.set(request.configId);
          this.deactivateDialogInput.set({
            modelIds: providerModelIds,
            allModels,
            context: 'provider',
            providerName: request.displayName,
            providerConfigId: request.configId,
          });
          this.deactivateDialogOpen.set(true);
        },
        error: () => {
          this.deactivateError.set('Failed to load models for provider deactivation. Please try again.');
        },
      });
  }

  closeDeactivateDialog(): void {
    this.deactivateDialogOpen.set(false);
    this.deactivateDialogInput.set(null);
    this.deactivatingModelIds.set([]);
    this.deactivatingProviderConfigId.set(null);
  }

  onDeactivateConfirmed(event: { replacementModelId: string }): void {
    const modelIds = this.deactivatingModelIds();
    const providerConfigId = this.deactivatingProviderConfigId();

    if (modelIds.length === 0) return;
    this.deactivateError.set(null);

    if (providerConfigId) {
      // Provider deactivation — backend handles model loop + provider config deactivation
      this.llmProviderService
        .deactivateProvider(providerConfigId, event.replacementModelId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.closeDeactivateDialog();
            this.modelListComponent?.loadModels();
            this.providerListComponent?.loadConfigs();
          },
          error: () => {
            this.deactivateError.set('Failed to deactivate provider. Please try again.');
            this.closeDeactivateDialog();
            this.modelListComponent?.loadModels();
            this.providerListComponent?.loadConfigs();
          },
        });
    } else if (modelIds.length === 1) {
      // Single model deactivation
      this.llmModelService
        .deactivateModel(modelIds[0], event.replacementModelId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.closeDeactivateDialog();
            this.modelListComponent?.loadModels();
          },
          error: () => {
            this.deactivateError.set('Failed to deactivate model. Please try again.');
            this.closeDeactivateDialog();
            this.modelListComponent?.loadModels();
          },
        });
    } else {
      // Bulk model deactivation (from models list "Deactivate All")
      forkJoin(
        modelIds.map((id) =>
          this.llmModelService.deactivateModel(id, event.replacementModelId),
        ),
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.closeDeactivateDialog();
            this.modelListComponent?.loadModels();
          },
          error: () => {
            this.deactivateError.set('Failed to deactivate models. Please try again.');
            this.closeDeactivateDialog();
            this.modelListComponent?.loadModels();
          },
        });
    }
  }
}
