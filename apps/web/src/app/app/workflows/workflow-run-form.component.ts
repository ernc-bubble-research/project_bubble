import { Component, DestroyRef, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import type {
  WorkflowTemplateResponseDto,
  WorkflowRunResponseDto,
} from '@project-bubble/shared';
import type {
  WorkflowInput,
  WorkflowInputSourceType,
} from '@project-bubble/shared';
import { WorkflowCatalogService } from '../../core/services/workflow-catalog.service';
import { AssetService } from '../../core/services/asset.service';

interface AssetOption {
  id: string;
  originalName: string;
}

interface InputState {
  definition: WorkflowInput;
  sourceMode: 'asset' | 'text';
  selectedAssetIds: string[];
  text: string;
  uploadedAssetId: string | null;
  uploading: boolean;
}

@Component({
  selector: 'app-workflow-run-form',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  template: `
    <div class="form-container">
      @if (loading()) {
        <div class="loading-state" data-testid="run-form-loading">
          <lucide-icon name="loader-2" [size]="24" class="spin"></lucide-icon>
          <span>Loading workflow...</span>
        </div>
      } @else if (loadError()) {
        <div class="error-state" data-testid="run-form-error">
          <lucide-icon name="alert-circle" [size]="24"></lucide-icon>
          <span>{{ loadError() }}</span>
          <button class="back-link" (click)="goBack()" data-testid="back-to-catalog">Back to Workflows</button>
        </div>
      } @else if (template()) {
        <div class="form-header">
          <button class="back-link" (click)="goBack()" data-testid="back-to-catalog">
            <lucide-icon name="arrow-left" [size]="16"></lucide-icon>
            Back to Workflows
          </button>
          <h1>{{ template()!.name }}</h1>
          @if (template()!.description) {
            <p class="description">{{ template()!.description }}</p>
          }
          <div class="credits-info">
            <lucide-icon name="zap" [size]="14"></lucide-icon>
            {{ template()!.creditsPerRun }} {{ template()!.creditsPerRun === 1 ? 'credit' : 'credits' }} per run
          </div>
        </div>

        @if (successMessage()) {
          <div class="success-banner" data-testid="run-success">
            <lucide-icon name="circle-check" [size]="20"></lucide-icon>
            {{ successMessage() }}
          </div>
        }

        <div class="inputs-section">
          <h2>Inputs</h2>

          @for (input of inputStates(); track input.definition.name) {
            <div class="input-group" [attr.data-testid]="'input-group-' + input.definition.name">
              <span class="input-label">
                {{ input.definition.label }}
                @if (input.definition.required) {
                  <span class="required-mark">*</span>
                }
              </span>
              @if (input.definition.description) {
                <p class="input-description">{{ input.definition.description }}</p>
              }

              <!-- Source toggle for mixed sources -->
              @if (hasMixedSources(input.definition)) {
                <div class="source-toggle" [attr.data-testid]="'source-toggle-' + input.definition.name">
                  @for (src of input.definition.source; track src) {
                    <button
                      class="toggle-btn"
                      [class.active]="input.sourceMode === mapSourceToMode(src)"
                      (click)="setSourceMode(input, src)"
                      [attr.data-testid]="'toggle-' + src + '-' + input.definition.name"
                    >
                      {{ src === 'text' ? 'Text' : 'File' }}
                    </button>
                  }
                </div>
              }

              <!-- Asset picker -->
              @if (shouldShowAssetPicker(input)) {
                <div class="asset-picker">
                  @if (input.definition.role === 'subject') {
                    <!-- Multi-select for subject inputs -->
                    <select
                      multiple
                      class="form-select multi-select"
                      [attr.data-testid]="'asset-select-' + input.definition.name"
                      (change)="onMultiAssetSelect($event, input)"
                    >
                      @for (asset of assets(); track asset.id) {
                        <option
                          [value]="asset.id"
                          [selected]="input.selectedAssetIds.includes(asset.id)"
                        >
                          {{ asset.originalName }}
                        </option>
                      }
                    </select>
                    <p class="help-text">Hold Ctrl/Cmd to select multiple files</p>
                  } @else {
                    <!-- Single select for context inputs -->
                    <select
                      class="form-select"
                      [attr.data-testid]="'asset-select-' + input.definition.name"
                      (change)="onAssetSelect($event, input)"
                    >
                      <option value="">Select a file...</option>
                      @for (asset of assets(); track asset.id) {
                        <option
                          [value]="asset.id"
                          [selected]="input.selectedAssetIds[0] === asset.id"
                        >
                          {{ asset.originalName }}
                        </option>
                      }
                    </select>
                  }
                </div>
              }

              <!-- File upload -->
              @if (shouldShowUpload(input)) {
                <div class="upload-zone" [attr.data-testid]="'upload-zone-' + input.definition.name">
                  @if (input.uploading) {
                    <div class="uploading-state">
                      <lucide-icon name="loader-2" [size]="20" class="spin"></lucide-icon>
                      <span>Uploading...</span>
                    </div>
                  } @else if (input.uploadedAssetId) {
                    <div class="uploaded-state">
                      <lucide-icon name="circle-check" [size]="20"></lucide-icon>
                      <span>File uploaded</span>
                    </div>
                  } @else {
                    <label class="dropzone">
                      <lucide-icon name="upload-cloud" [size]="32"></lucide-icon>
                      <span>Click to upload a file</span>
                      @if (input.definition.accept?.extensions?.length) {
                        <span class="accept-hint">Accepts: {{ input.definition.accept!.extensions!.join(', ') }}</span>
                      }
                      <input
                        type="file"
                        class="file-input"
                        [accept]="getAcceptString(input.definition)"
                        (change)="onFileUpload($event, input)"
                        [attr.data-testid]="'file-input-' + input.definition.name"
                      />
                    </label>
                  }
                </div>
              }

              <!-- Text area -->
              @if (shouldShowText(input)) {
                <textarea
                  class="form-textarea"
                  [placeholder]="input.definition.text_config?.placeholder ?? 'Enter text...'"
                  [maxLength]="input.definition.text_config?.max_length ?? 10000"
                  [attr.data-testid]="'text-input-' + input.definition.name"
                  [(ngModel)]="input.text"
                  (ngModelChange)="onTextChange()"
                  rows="4"
                ></textarea>
              }

              <!-- Validation message -->
              @if (submitted() && input.definition.required && !isInputFilled(input)) {
                <p class="validation-error" [attr.data-testid]="'error-' + input.definition.name">
                  This field is required
                </p>
              }
            </div>
          }
        </div>

        @if (submitError()) {
          <div class="error-banner" data-testid="submit-error">
            <lucide-icon name="alert-circle" [size]="16"></lucide-icon>
            {{ submitError() }}
          </div>
        }

        <div class="form-actions">
          <button
            class="submit-button"
            [disabled]="!canSubmit() || submitting()"
            (click)="onSubmit()"
            data-testid="submit-run"
          >
            @if (submitting()) {
              <lucide-icon name="loader-2" [size]="16" class="spin"></lucide-icon>
              Submitting...
            } @else {
              <lucide-icon name="zap" [size]="16"></lucide-icon>
              Run Workflow
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .form-container {
      padding: 32px;
      max-width: 720px;
      margin: 0 auto;
    }

    .form-header {
      margin-bottom: 32px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: var(--text-main);
        margin: 12px 0 4px;
      }

      .description {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 0 0 8px;
      }

      .credits-info {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 13px;
        font-weight: 600;
        color: var(--primary-700);
        background: var(--primary-50);
        padding: 4px 10px;
        border-radius: var(--radius-full);
      }
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--text-secondary);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;

      &:hover {
        color: var(--primary-600);
      }
    }

    .inputs-section {
      margin-bottom: 24px;

      h2 {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-main);
        margin: 0 0 16px;
      }
    }

    .input-group {
      margin-bottom: 20px;
      padding: 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--radius-lg);
    }

    .input-label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 4px;
    }

    .required-mark {
      color: var(--danger);
      margin-left: 2px;
    }

    .input-description {
      font-size: 12px;
      color: var(--text-secondary);
      margin: 0 0 8px;
    }

    .source-toggle {
      display: flex;
      gap: 0;
      margin-bottom: 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      overflow: hidden;
      width: fit-content;
    }

    .toggle-btn {
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 500;
      border: none;
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;

      &.active {
        background: var(--primary-600);
        color: white;
      }

      &:not(:last-child) {
        border-right: 1px solid var(--border-color);
      }
    }

    .form-select {
      width: 100%;
      padding: 8px 12px;
      font-size: 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      color: var(--text-main);

      &:focus {
        outline: 2px solid var(--primary-600);
        outline-offset: -1px;
      }
    }

    .multi-select {
      min-height: 100px;
    }

    .help-text {
      font-size: 11px;
      color: var(--text-tertiary);
      margin: 4px 0 0;
    }

    .upload-zone {
      margin-top: 4px;
    }

    .dropzone {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 24px;
      border: 2px dashed var(--border-color);
      border-radius: var(--radius-lg);
      cursor: pointer;
      color: var(--text-secondary);
      font-size: 13px;
      text-align: center;
      transition: border-color 0.15s;

      &:hover {
        border-color: var(--primary-400);
      }

      .accept-hint {
        font-size: 11px;
        color: var(--text-tertiary);
      }
    }

    .file-input {
      display: none;
    }

    .uploading-state,
    .uploaded-state {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      font-size: 13px;
      color: var(--text-secondary);
      background: var(--slate-50);
      border-radius: var(--radius-md);
    }

    .uploaded-state {
      color: var(--success-text);
      background: var(--success-bg);
    }

    .form-textarea {
      width: 100%;
      padding: 10px 12px;
      font-size: 14px;
      font-family: inherit;
      border: 1px solid var(--border-color);
      border-radius: var(--radius-md);
      background: var(--bg-surface);
      color: var(--text-main);
      resize: vertical;
      box-sizing: border-box;

      &:focus {
        outline: 2px solid var(--primary-600);
        outline-offset: -1px;
      }
    }

    .validation-error {
      font-size: 12px;
      color: var(--danger-text);
      margin: 6px 0 0;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      padding-top: 8px;
    }

    .submit-button {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      color: white;
      background: var(--primary-600);
      border: none;
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: background 0.15s;

      &:hover:not(:disabled) {
        background: var(--primary-700);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .success-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--success-bg);
      color: var(--success-text);
      border-radius: var(--radius-md);
      font-size: 14px;
      margin-bottom: 16px;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      background: var(--danger-bg);
      color: var(--danger-text);
      border-radius: var(--radius-md);
      font-size: 14px;
      margin-bottom: 16px;
    }

    .loading-state,
    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 80px 20px;
      text-align: center;
      color: var(--text-secondary);
    }

    .loading-state {
      flex-direction: row;
    }

    .error-state {
      color: var(--danger-text);
    }

    .spin {
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `],
})
export class WorkflowRunFormComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(WorkflowCatalogService);
  private readonly assetService = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  readonly template = signal<WorkflowTemplateResponseDto | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly assets = signal<AssetOption[]>([]);
  readonly inputStates = signal<InputState[]>([]);
  readonly submitted = signal(false);
  readonly submitting = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly canSubmit = computed(() => {
    if (this.submitting() || this.successMessage()) return false;
    const states = this.inputStates();
    return states.every((s) => !s.definition.required || this.isInputFilled(s));
  });

  constructor() {
    const templateId = this.route.snapshot.paramMap.get('templateId');
    if (!templateId) {
      this.loadError.set('No template ID provided');
      this.loading.set(false);
      return;
    }
    this.loadTemplate(templateId);
    this.loadAssets();
  }

  private loadTemplate(id: string): void {
    this.catalogService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tmpl) => {
          this.template.set(tmpl);
          this.buildInputStates(tmpl);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set('Workflow template not found');
          this.loading.set(false);
        },
      });
  }

  private loadAssets(): void {
    this.assetService
      .findAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.assets.set(
            data.map((a) => ({ id: a.id, originalName: a.originalName })),
          );
        },
      });
  }

  private buildInputStates(tmpl: WorkflowTemplateResponseDto): void {
    const def = tmpl.currentVersion?.definition as Record<string, unknown> | undefined;
    const inputs = (def?.['inputs'] as WorkflowInput[]) ?? [];

    const states: InputState[] = inputs.map((input) => ({
      definition: input,
      sourceMode: input.source.includes('text') && !input.source.includes('asset') && !input.source.includes('upload')
        ? 'text'
        : 'asset',
      selectedAssetIds: [],
      text: '',
      uploadedAssetId: null,
      uploading: false,
    }));

    this.inputStates.set(states);
  }

  hasMixedSources(def: WorkflowInput): boolean {
    const hasFile = def.source.includes('asset') || def.source.includes('upload');
    const hasText = def.source.includes('text');
    return hasFile && hasText;
  }

  mapSourceToMode(src: WorkflowInputSourceType): 'asset' | 'text' {
    return src === 'text' ? 'text' : 'asset';
  }

  setSourceMode(input: InputState, src: WorkflowInputSourceType): void {
    input.sourceMode = this.mapSourceToMode(src);
    this.inputStates.update((arr) => [...arr]);
  }

  shouldShowAssetPicker(input: InputState): boolean {
    if (input.sourceMode !== 'asset') return false;
    return input.definition.source.includes('asset');
  }

  shouldShowUpload(input: InputState): boolean {
    if (input.sourceMode !== 'asset') return false;
    return input.definition.source.includes('upload') && !input.definition.source.includes('asset');
  }

  shouldShowText(input: InputState): boolean {
    return input.sourceMode === 'text';
  }

  isInputFilled(input: InputState): boolean {
    if (input.sourceMode === 'text') {
      return input.text.trim().length > 0;
    }
    return input.selectedAssetIds.length > 0 || input.uploadedAssetId !== null;
  }

  onAssetSelect(event: Event, input: InputState): void {
    const select = event.target as HTMLSelectElement;
    input.selectedAssetIds = select.value ? [select.value] : [];
    this.inputStates.update((arr) => [...arr]);
  }

  onMultiAssetSelect(event: Event, input: InputState): void {
    const select = event.target as HTMLSelectElement;
    const selected: string[] = [];
    for (let i = 0; i < select.options.length; i++) {
      if (select.options[i].selected) {
        selected.push(select.options[i].value);
      }
    }
    input.selectedAssetIds = selected;
    this.inputStates.update((arr) => [...arr]);
  }

  onTextChange(): void {
    // ngModel updates input.text in place — refresh signal identity so canSubmit recomputes
    this.inputStates.update((arr) => [...arr]);
  }

  onFileUpload(event: Event, input: InputState): void {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    const maxSizeMb = input.definition.accept?.max_size_mb;
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      this.submitError.set(`File exceeds maximum size of ${maxSizeMb}MB`);
      return;
    }

    input.uploading = true;
    this.inputStates.update((arr) => [...arr]);

    this.assetService
      .upload(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (asset) => {
          input.uploadedAssetId = asset.id;
          input.selectedAssetIds = [asset.id];
          input.uploading = false;
          this.inputStates.update((arr) => [...arr]);
        },
        error: () => {
          input.uploading = false;
          this.inputStates.update((arr) => [...arr]);
          this.submitError.set('File upload failed');
        },
      });
  }

  getAcceptString(def: WorkflowInput): string {
    if (!def.accept?.extensions?.length) return '';
    // Extensions from FILE_TYPE_PRESETS already include the dot prefix (e.g., '.pdf')
    return def.accept.extensions.map((ext) => ext.startsWith('.') ? ext : `.${ext}`).join(',');
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.submitError.set(null);

    if (!this.canSubmit()) return;

    const tmpl = this.template();
    if (!tmpl) return;

    const inputs: Record<string, { type: 'asset' | 'text'; assetIds?: string[]; text?: string }> = {};
    for (const state of this.inputStates()) {
      if (state.sourceMode === 'text') {
        inputs[state.definition.name] = { type: 'text', text: state.text };
      } else {
        inputs[state.definition.name] = { type: 'asset', assetIds: state.selectedAssetIds };
      }
    }

    this.submitting.set(true);

    this.catalogService
      .submitRun({ templateId: tmpl.id, inputs })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (run: WorkflowRunResponseDto) => {
          this.submitting.set(false);
          this.successMessage.set(`Workflow run queued successfully (ID: ${run.id.slice(0, 8)}...)`);
          // No auto-redirect — user navigates manually via "Back to Workflows" button
        },
        error: (err) => {
          this.submitting.set(false);
          const msg = err?.error?.message || 'Failed to submit workflow run';
          this.submitError.set(msg);
        },
      });
  }

  goBack(): void {
    this.router.navigate(['/app/workflows']);
  }
}
