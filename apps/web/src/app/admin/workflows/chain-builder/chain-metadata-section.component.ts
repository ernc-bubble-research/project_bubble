import { Component, input, output, inject, OnInit, OnChanges, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { ChainMetadata } from '@project-bubble/shared';
import { InfoTooltipComponent } from '../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, InfoTooltipComponent],
  selector: 'app-chain-metadata-section',
  template: `
    <div class="metadata-section">
      <h2 class="section-title">Chain Details</h2>
      <p class="section-description">Basic information about your workflow chain.</p>

      <form [formGroup]="form" class="form-fields">
        <div class="form-group">
          <label for="chain-name">
            Name <span class="required">*</span>
          </label>
          <input
            id="chain-name"
            type="text"
            formControlName="name"
            placeholder="e.g., Full Qualitative Analysis"
            data-testid="chain-name-input"
          />
          @if (form.get('name')?.touched && form.get('name')?.hasError('required')) {
            <span class="field-error">Name is required</span>
          }
          @if (form.get('name')?.touched && form.get('name')?.hasError('maxlength')) {
            <span class="field-error">Name must be 255 characters or less</span>
          }
        </div>

        <div class="form-group">
          <label for="chain-description">
            Description
            <app-info-tooltip text="Describe what this chain accomplishes and its purpose" />
          </label>
          <textarea
            id="chain-description"
            formControlName="description"
            rows="3"
            placeholder="Describe what this chain does..."
            data-testid="chain-description-input"
          ></textarea>
        </div>
      </form>
    </div>
  `,
  styleUrl: '../wizard/steps/wizard-step-shared.scss',
})
export class ChainMetadataSectionComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  metadata = input<ChainMetadata | undefined>();
  metadataChange = output<ChainMetadata>();

  form!: FormGroup;

  ngOnInit(): void {
    this.initForm();
  }

  ngOnChanges(): void {
    if (this.form) {
      this.populateFromInput();
    }
  }

  private initForm(): void {
    const meta = this.metadata();
    this.form = this.fb.group({
      name: [meta?.name || '', [Validators.required, Validators.maxLength(255)]],
      description: [meta?.description || ''],
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());
  }

  private populateFromInput(): void {
    const meta = this.metadata();
    if (meta) {
      this.form.patchValue({
        name: meta.name || '',
        description: meta.description || '',
      }, { emitEvent: false });
    }
  }

  private syncToParent(): void {
    const val = this.form.value;
    this.metadataChange.emit({
      name: val.name,
      description: val.description || '',
    });
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }
}
