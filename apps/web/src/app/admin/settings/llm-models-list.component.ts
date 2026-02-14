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
import { PROVIDER_DISPLAY_NAMES } from './provider-constants';

export interface ProviderGroup {
  providerKey: string;
  displayName: string;
  models: LlmModel[];
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly models = signal<LlmModel[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly togglingId = signal<string | null>(null);
  readonly bulkTogglingProvider = signal<string | null>(null);

  readonly addModelClicked = output<void>();
  readonly editModelClicked = output<LlmModel>();

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
      displayName: PROVIDER_DISPLAY_NAMES[key] ?? key,
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

    this.togglingId.set(model.id);

    this.llmModelService
      .updateModel(model.id, { isActive: !model.isActive })
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
