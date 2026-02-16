import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';

export interface ProviderGroup {
  providerKey: string;
  displayName: string;
  models: LlmModel[];
}

export interface DeactivateModelRequest {
  modelId: string;
  allModels: LlmModel[];
}

export interface DeactivateBulkRequest {
  providerKey: string;
  modelIds: string[];
  allModels: LlmModel[];
}

@Component({
  standalone: true,
  imports: [LucideAngularModule],
  selector: 'app-llm-models-list',
  templateUrl: './llm-models-list.component.html',
  styleUrl: './llm-models-list.component.scss',
})
export class LlmModelsListComponent {
  private readonly llmModelService = inject(LlmModelService);
  private readonly providerTypeService = inject(ProviderTypeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly models = signal<LlmModel[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);
  readonly bulkTogglingProvider = signal<string | null>(null);

  readonly addModelClicked = output<void>();
  readonly editModelClicked = output<LlmModel>();
  readonly deactivateRequested = output<DeactivateModelRequest>();
  readonly deactivateBulkRequested = output<DeactivateBulkRequest>();

  readonly providerGroups = computed<ProviderGroup[]>(() => {
    const modelList = this.models();
    const groupMap = new Map<string, LlmModel[]>();

    for (const model of modelList) {
      const existing = groupMap.get(model.providerKey) ?? [];
      existing.push(model);
      groupMap.set(model.providerKey, existing);
    }

    // Sort providers alphabetically
    const sortedKeys = [...groupMap.keys()].sort((a, b) => a.localeCompare(b));

    return sortedKeys.map((key) => ({
      providerKey: key,
      displayName: this.providerTypeService.getDisplayName(key),
      models: groupMap.get(key)!.sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      ),
    }));
  });

  readonly isEmpty = computed(() => this.models().length === 0 && !this.loading());

  constructor() {
    this.loadModels();
  }

  loadModels(): void {
    this.loading.set(true);
    this.error.set(null);

    this.llmModelService
      .getAllModels()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (models) => {
          this.models.set(models);
          this.loading.set(false);
          this.cdr.markForCheck();
        },
        error: () => {
          this.error.set('Failed to load LLM models. Please try again.');
          this.loading.set(false);
          this.cdr.markForCheck();
        },
      });
  }

  onAddModel(): void {
    this.addModelClicked.emit();
  }

  onEditModel(model: LlmModel): void {
    this.editModelClicked.emit(model);
  }

  onToggleActive(model: LlmModel): void {
    if (this.togglingId()) return; // Prevent double-click

    // If deactivating an active model → delegate to parent (show dialog)
    if (model.isActive) {
      this.deactivateRequested.emit({
        modelId: model.id,
        allModels: this.models(),
      });
      return;
    }

    // Activating an inactive model → proceed directly
    this.togglingId.set(model.id);

    this.llmModelService
      .updateModel(model.id, { isActive: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.models.update((list) =>
            list.map((m) => (m.id === updated.id ? updated : m))
          );
          this.togglingId.set(null);
          this.cdr.markForCheck();
        },
        error: () => {
          this.error.set('Failed to update model status. Please try again.');
          this.togglingId.set(null);
          this.cdr.markForCheck();
        },
      });
  }

  onBulkToggle(providerKey: string, isActive: boolean): void {
    if (this.bulkTogglingProvider()) return; // Prevent double-click

    // If bulk deactivating → delegate to parent (show dialog)
    if (!isActive) {
      const modelIds = this.models()
        .filter((m) => m.providerKey === providerKey && m.isActive)
        .map((m) => m.id);
      if (modelIds.length > 0) {
        this.deactivateBulkRequested.emit({
          providerKey,
          modelIds,
          allModels: this.models(),
        });
        return;
      }
    }

    // Bulk activating → proceed directly
    this.bulkTogglingProvider.set(providerKey);

    this.llmModelService
      .bulkUpdateStatus({ providerKey, isActive })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.models.update((list) =>
            list.map((m) =>
              m.providerKey === providerKey
                ? { ...m, isActive, updatedAt: new Date() }
                : m
            )
          );
          this.bulkTogglingProvider.set(null);
          this.cdr.markForCheck();
        },
        error: () => {
          this.error.set('Failed to bulk update model status. Please try again.');
          this.bulkTogglingProvider.set(null);
          this.cdr.markForCheck();
        },
      });
  }

  formatContextWindow(value: number): string {
    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(0)}K`;
    }
    return value.toString();
  }
}
