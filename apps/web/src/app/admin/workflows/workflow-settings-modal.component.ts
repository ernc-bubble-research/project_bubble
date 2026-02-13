import {
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UpperCasePipe } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Observable } from 'rxjs';
import { WorkflowTemplateService } from '../../core/services/workflow-template.service';
import { WorkflowChainService } from '../../core/services/workflow-chain.service';
import { TenantService } from '../../core/services/tenant.service';
import { ToastService } from '../../core/services/toast.service';
import type {
  WorkflowTemplateResponseDto,
  WorkflowChainResponseDto,
  Tenant,
} from '@project-bubble/shared';

export type WorkflowSettingsTarget =
  | { type: 'template'; data: WorkflowTemplateResponseDto }
  | { type: 'chain'; data: WorkflowChainResponseDto };

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, LucideAngularModule, UpperCasePipe],
  selector: 'app-workflow-settings-modal',
  templateUrl: './workflow-settings-modal.component.html',
  styleUrl: './workflow-settings-modal.component.scss',
})
export class WorkflowSettingsModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(WorkflowTemplateService);
  private readonly chainService = inject(WorkflowChainService);
  private readonly tenantService = inject(TenantService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  target = input.required<WorkflowSettingsTarget>();

  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly tenants = signal<Tenant[]>([]);
  readonly tenantsLoading = signal(false);
  readonly confirmingArchive = signal(false);

  readonly isTemplate = computed(() => this.target().type === 'template');
  readonly targetName = computed(() => this.target().data.name);
  readonly canArchive = computed(() => this.target().data.status !== 'archived');
  readonly canPublish = computed(() => this.isTemplate() && this.target().data.status === 'draft');
  readonly canUnpublish = computed(() => this.isTemplate() && this.target().data.status === 'published');

  readonly form = this.fb.nonNullable.group({
    visibility: ['public' as 'public' | 'private', [Validators.required]],
    allowedTenants: [[] as string[]],
  });

  constructor() {
    // One-shot init: patches form with target's current values.
    // Uses effect() because signal inputs are not available until after input binding.
    effect(() => {
      const t = this.target();
      this.form.patchValue({
        visibility: t.data.visibility as 'public' | 'private',
        allowedTenants: t.data.allowedTenants ?? [],
      });
    });

    this.loadTenants();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onVisibilityChange(): void {
    if (this.form.controls.visibility.value === 'public') {
      this.form.controls.allowedTenants.setValue([]);
    }
  }

  onTenantToggle(tenantId: string): void {
    const current = this.form.controls.allowedTenants.value;
    if (current.includes(tenantId)) {
      this.form.controls.allowedTenants.setValue(current.filter(id => id !== tenantId));
    } else {
      this.form.controls.allowedTenants.setValue([...current, tenantId]);
    }
  }

  isTenantSelected(tenantId: string): boolean {
    return this.form.controls.allowedTenants.value.includes(tenantId);
  }

  onSave(): void {
    if (this.submitting()) return;

    const visibility = this.form.controls.visibility.value;
    const allowedTenants = this.form.controls.allowedTenants.value;

    if (visibility === 'private' && allowedTenants.length === 0) {
      this.error.set('Private visibility requires at least one tenant to be selected.');
      return;
    }

    // No changes — close without API call
    if (!this.form.dirty) {
      this.saved.emit();
      return;
    }

    const target = this.target();
    const payload = {
      visibility,
      allowedTenants: visibility === 'private' ? allowedTenants : [],
    };

    if (target.type === 'template') {
      this.executeRequest(
        this.templateService.update(target.data.id, payload),
        `"${target.data.name}" settings updated`,
      );
    } else {
      this.executeRequest(
        this.chainService.update(target.data.id, payload),
        `"${target.data.name}" settings updated`,
      );
    }
  }

  onPublish(): void {
    if (this.submitting()) return;

    const target = this.target();
    if (target.type !== 'template') return;

    this.executeRequest(
      this.templateService.update(target.data.id, { status: 'published' }),
      `"${target.data.name}" published`,
    );
  }

  onUnpublish(): void {
    if (this.submitting()) return;

    const target = this.target();
    if (target.type !== 'template') return;

    this.executeRequest(
      this.templateService.update(target.data.id, { status: 'draft' }),
      `"${target.data.name}" unpublished`,
    );
  }

  onArchiveClick(): void {
    this.confirmingArchive.set(true);
  }

  onArchiveCancel(): void {
    this.confirmingArchive.set(false);
  }

  onArchiveConfirm(): void {
    if (this.submitting()) return;
    this.confirmingArchive.set(false);

    const target = this.target();

    if (target.type === 'template') {
      this.executeRequest(
        this.templateService.update(target.data.id, { status: 'archived' }),
        `"${target.data.name}" archived`,
      );
    } else {
      this.executeRequest(
        this.chainService.delete(target.data.id),
        `"${target.data.name}" archived`,
      );
    }
  }

  onUnarchive(): void {
    if (this.submitting()) return;

    const target = this.target();

    if (target.type === 'template') {
      this.executeRequest(
        this.templateService.update(target.data.id, { status: 'draft' }),
        `"${target.data.name}" restored to draft`,
      );
    } else {
      this.executeRequest(
        this.chainService.restore(target.data.id),
        `"${target.data.name}" restored`,
      );
    }
  }

  private executeRequest(request$: Observable<unknown>, successMessage: string): void {
    this.submitting.set(true);
    this.error.set(null);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toastService.show(successMessage);
        this.saved.emit();
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.error.set(this.getErrorMessage(err));
      },
    });
  }

  private loadTenants(): void {
    this.tenantsLoading.set(true);
    this.tenantService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tenants) => {
          this.tenants.set(tenants.filter(t => t.id !== '00000000-0000-0000-0000-000000000000'));
          this.tenantsLoading.set(false);
        },
        error: () => {
          this.tenants.set([]);
          this.tenantsLoading.set(false);
        },
      });
  }

  private getErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 400) {
      return 'Invalid data. Please check your inputs.';
    }
    if (err.status === 404) {
      return 'Workflow not found. It may have been deleted.';
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
