import { Component, input, output, inject, OnInit, OnChanges, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { WorkflowDefinition } from '@project-bubble/shared';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InfoTooltipComponent],
  selector: 'app-wizard-metadata-step',
  template: `
    <div class="step-section">
      <h2 class="step-title">Metadata</h2>
      <p class="step-description">Basic information about your workflow template.</p>

      <form [formGroup]="form" class="form-fields">
        <div class="form-group">
          <label for="name">
            Name <span class="required">*</span>
          </label>
          <input
            id="name"
            type="text"
            formControlName="name"
            placeholder="e.g., Analyze Transcript"
            data-testid="metadata-name-input"
          />
          @if (form.get('name')?.touched && form.get('name')?.hasError('required')) {
            <span class="field-error">Name is required</span>
          }
        </div>

        <div class="form-group">
          <label for="description">
            Description <span class="required">*</span>
          </label>
          <textarea
            id="description"
            formControlName="description"
            rows="3"
            placeholder="Describe what this workflow does..."
            data-testid="metadata-description-input"
          ></textarea>
          @if (form.get('description')?.touched && form.get('description')?.hasError('required')) {
            <span class="field-error">Description is required</span>
          }
        </div>

        <div class="form-group">
          <label for="tags">
            Tags
            <app-info-tooltip text="Comma-separated tags for organizing and filtering workflows" />
          </label>
          <input
            id="tags"
            type="text"
            formControlName="tags"
            placeholder="e.g., research, analysis, transcripts"
            data-testid="metadata-tags-input"
          />
          <span class="field-hint">Separate tags with commas</span>
        </div>
      </form>
    </div>
  `,
  styleUrl: './wizard-step-shared.scss',
})
export class WizardMetadataStepComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(): void {
    if (this.form) {
      this.populateFromState();
    }
  }

  private initForm(): void {
    const meta = this.state()?.metadata;
    this.form = this.fb.group({
      name: [meta?.name || '', [Validators.required]],
      description: [meta?.description || '', [Validators.required]],
      tags: [meta?.tags?.join(', ') || ''],
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());
  }

  private populateFromState(): void {
    const meta = this.state()?.metadata;
    if (meta) {
      // Don't patch 'tags' — the comma-separated text is managed locally.
      // Patching from parent would strip trailing commas mid-typing.
      this.form.patchValue({
        name: meta.name || '',
        description: meta.description || '',
      }, { emitEvent: false });
    }
  }

  private syncToParent(): void {
    const val = this.form.value;
    const tags = val.tags
      ? val.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
      : [];

    this.stateChange.emit({
      metadata: {
        name: val.name,
        description: val.description,
        version: this.state()?.metadata?.version || 1,
        tags,
      },
    });
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }
}
