import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin } from 'rxjs';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import type { AffectedWorkflowDto } from '@project-bubble/shared';

export interface DeactivateDialogInput {
  /** Model IDs being deactivated */
  modelIds: string[];
  /** All models in the system (for replacement dropdown) */
  allModels: LlmModel[];
  /** Display context */
  context: 'model' | 'provider';
  /** Provider name (for provider context) */
  providerName?: string;
  /** Provider config ID — when set, confirmed handler deactivates provider + its models */
  providerConfigId?: string;
}

@Component({
  standalone: true,
  imports: [FormsModule, LucideAngularModule],
  selector: 'app-model-deactivate-dialog',
  templateUrl: './model-deactivate-dialog.component.html',
  styleUrl: './model-deactivate-dialog.component.scss',
})
export class ModelDeactivateDialogComponent {
  private readonly llmModelService = inject(LlmModelService);
  private readonly destroyRef = inject(DestroyRef);

  readonly dialogInput = input.required<DeactivateDialogInput>();
  readonly confirmed = output<{ replacementModelId: string }>();
  readonly cancelled = output<void>();

  readonly affectedWorkflows = signal<AffectedWorkflowDto[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedReplacementId = signal<string>('');

  readonly replacementModels = computed(() => {
    const data = this.dialogInput();
    const deactivatingIds = new Set(data.modelIds);
    return data.allModels.filter(
      (m) => m.isActive && !deactivatingIds.has(m.id),
    );
  });

  readonly hasReplacements = computed(() => this.replacementModels().length > 0);

  readonly canConfirm = computed(
    () =>
      this.hasReplacements() &&
      this.selectedReplacementId() !== '' &&
      !this.submitting(),
  );

  readonly dialogTitle = computed(() => {
    const data = this.dialogInput();
    if (data.context === 'provider') {
      return `Deactivate Provider: ${data.providerName ?? 'Unknown'}`;
    }
    return 'Deactivate Model';
  });

  constructor() {
    // Load affected workflows when the component initializes
    // Use a microtask to ensure input is available
    queueMicrotask(() => this.loadAffectedWorkflows());
  }

  private loadAffectedWorkflows(): void {
    const data = this.dialogInput();
    if (data.modelIds.length === 0) {
      this.loading.set(false);
      return;
    }

    if (data.modelIds.length === 1) {
      // Single model — one API call
      this.llmModelService
        .getAffectedWorkflows(data.modelIds[0])
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (workflows) => {
            this.affectedWorkflows.set(workflows);
            this.loading.set(false);

          },
          error: () => {
            this.error.set('Failed to load affected workflows.');
            this.loading.set(false);

          },
        });
    } else {
      // Multiple models — fetch for each and merge (deduplicate by versionId)
      forkJoin(
        data.modelIds.map((id) => this.llmModelService.getAffectedWorkflows(id)),
      )
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (results) => {
            const seen = new Set<string>();
            const unique = results.flat().filter((wf) => {
              if (seen.has(wf.versionId)) return false;
              seen.add(wf.versionId);
              return true;
            });
            this.affectedWorkflows.set(unique);
            this.loading.set(false);

          },
          error: () => {
            this.error.set('Failed to load affected workflows.');
            this.loading.set(false);

          },
        });
    }
  }

  onReplacementChange(value: string): void {
    this.selectedReplacementId.set(value);
  }

  onConfirm(): void {
    if (!this.canConfirm()) return;
    this.submitting.set(true);
    this.confirmed.emit({ replacementModelId: this.selectedReplacementId() });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'published':
        return 'badge-published';
      case 'draft':
        return 'badge-draft';
      case 'archived':
        return 'badge-archived';
      default:
        return 'badge-default';
    }
  }
}
