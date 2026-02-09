import { Component, input, output, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import type {
  WorkflowDefinition,
  WorkflowInput,
  WorkflowInputSourceType,
} from '@project-bubble/shared';
import { FILE_TYPE_PRESETS } from '@project-bubble/shared/web';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

interface InputPresetState {
  activePresets: Set<string>;
  customExtensions: string[];
}

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, InfoTooltipComponent],
  selector: 'app-wizard-inputs-step',
  templateUrl: './wizard-inputs-step.component.html',
  styleUrl: './wizard-step-shared.scss',
})
export class WizardInputsStepComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  form!: FormGroup;
  collapsedCards = signal<Set<number>>(new Set());
  readonly presets = FILE_TYPE_PRESETS;

  inputPresetState = signal<InputPresetState[]>([]);

  subjectCount = computed(() => {
    const inputs = this.state()?.inputs || [];
    return inputs.filter((i) => i.role === 'subject').length;
  });

  subjectError = computed(() => {
    const count = this.subjectCount();
    if (count === 0) return 'Exactly 1 subject input is required (currently 0)';
    if (count > 1) return `Exactly 1 subject input is required (currently ${count})`;
    return null;
  });

  duplicateNames = computed(() => {
    const inputs = this.state()?.inputs || [];
    const names = inputs.map((i) => i.name).filter((n) => n);
    return names.filter((name, index) => names.indexOf(name) !== index);
  });

  sourceError = signal<string | null>(null);

  get inputsArray(): FormArray {
    return this.form.get('inputs') as FormArray;
  }

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    const existingInputs = this.state()?.inputs || [];
    const inputGroups = existingInputs.map((inp) => this.createInputGroup(inp));

    this.form = this.fb.group({
      inputs: this.fb.array(inputGroups),
    });

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());
  }

  private createInputGroup(inp?: WorkflowInput): FormGroup {
    const existingExts = new Set(inp?.accept?.extensions || []);
    const activePresets = new Set<string>();
    const customExtensions: string[] = [];

    // Reverse-map: check if ALL extensions of a preset are present
    const nonAllPresets = FILE_TYPE_PRESETS.filter((p) => p.key !== 'all');
    for (const preset of nonAllPresets) {
      if (preset.extensions.length > 0 && preset.extensions.every((ext) => existingExts.has(ext))) {
        activePresets.add(preset.key);
        for (const ext of preset.extensions) {
          existingExts.delete(ext);
        }
      }
    }

    // Remaining unmatched extensions are custom
    for (const ext of existingExts) {
      customExtensions.push(ext);
    }

    this.inputPresetState.update((states) => [...states, { activePresets, customExtensions }]);

    return this.fb.group({
      name: [inp?.name || '', [Validators.required]],
      label: [inp?.label || '', [Validators.required]],
      description: [inp?.description || ''],
      role: [inp?.role || 'context'],
      source_asset: [inp?.source?.includes('asset') || false],
      source_upload: [inp?.source?.includes('upload') || false],
      source_text: [inp?.source?.includes('text') || false],
      required: [inp?.required ?? true],
      accept_max_size_mb: [inp?.accept?.max_size_mb ?? null, [Validators.min(1)]],
      text_placeholder: [inp?.text_config?.placeholder || ''],
      text_max_length: [inp?.text_config?.max_length ?? null, [Validators.min(1)]],
    });
  }

  addInput(): void {
    this.inputsArray.push(this.createInputGroup());
    this.syncToParent();
  }

  removeInput(index: number): void {
    this.inputsArray.removeAt(index);
    this.inputPresetState.update((states) => {
      const updated = [...states];
      updated.splice(index, 1);
      return updated;
    });
    this.syncToParent();
  }

  toggleCollapse(index: number): void {
    this.collapsedCards.update((set) => {
      const next = new Set(set);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  isCollapsed(index: number): boolean {
    return this.collapsedCards().has(index);
  }

  hasFileSource(index: number): boolean {
    const group = this.inputsArray.at(index) as FormGroup;
    return group.get('source_asset')?.value || group.get('source_upload')?.value;
  }

  hasTextSource(index: number): boolean {
    const group = this.inputsArray.at(index) as FormGroup;
    return group.get('source_text')?.value;
  }

  isPresetActive(index: number, key: string): boolean {
    return this.inputPresetState()[index]?.activePresets.has(key) || false;
  }

  getCustomExtensions(index: number): string[] {
    return this.inputPresetState()[index]?.customExtensions || [];
  }

  togglePreset(index: number, key: string): void {
    this.inputPresetState.update((states) => {
      const updated = [...states];
      const current = updated[index];
      const activePresets = new Set(current.activePresets);
      let customExtensions = [...current.customExtensions];

      if (key === 'all') {
        if (activePresets.has('all')) {
          activePresets.delete('all');
        } else {
          activePresets.clear();
          activePresets.add('all');
          customExtensions = [];
        }
      } else {
        activePresets.delete('all');
        if (activePresets.has(key)) {
          activePresets.delete(key);
        } else {
          activePresets.add(key);
        }
      }

      updated[index] = { activePresets, customExtensions };
      return updated;
    });
    this.syncToParent();
  }

  addCustomExtension(index: number, value: string): void {
    let normalized = value.replace(/,/g, '').trim().toLowerCase();
    if (!normalized) return;
    if (!normalized.startsWith('.')) normalized = '.' + normalized;

    this.inputPresetState.update((states) => {
      const updated = [...states];
      const current = updated[index];
      const activePresets = new Set(current.activePresets);
      const customExtensions = [...current.customExtensions];

      if (!customExtensions.includes(normalized)) {
        customExtensions.push(normalized);
      }
      activePresets.delete('all');

      updated[index] = { activePresets, customExtensions };
      return updated;
    });
    this.syncToParent();
  }

  removeCustomExtension(index: number, ext: string): void {
    this.inputPresetState.update((states) => {
      const updated = [...states];
      const current = updated[index];
      updated[index] = {
        activePresets: new Set(current.activePresets),
        customExtensions: current.customExtensions.filter((e) => e !== ext),
      };
      return updated;
    });
    this.syncToParent();
  }

  private syncToParent(): void {
    const rawInputs = this.inputsArray.value;
    const inputs: WorkflowInput[] = rawInputs.map((raw: Record<string, unknown>, inputIndex: number) => {
      const source: WorkflowInputSourceType[] = [];
      if (raw['source_asset']) source.push('asset');
      if (raw['source_upload']) source.push('upload');
      if (raw['source_text']) source.push('text');

      const inp: WorkflowInput = {
        name: raw['name'] as string,
        label: raw['label'] as string,
        role: raw['role'] as 'context' | 'subject',
        source: source.length > 0 ? source : ['asset'],
        required: raw['required'] as boolean,
      };

      if (raw['description']) {
        inp.description = raw['description'] as string;
      }

      if (raw['source_asset'] || raw['source_upload']) {
        const presetState = this.inputPresetState()[inputIndex];
        const extensions: string[] = [];

        if (presetState && !presetState.activePresets.has('all')) {
          for (const presetKey of presetState.activePresets) {
            const preset = FILE_TYPE_PRESETS.find((p) => p.key === presetKey);
            if (preset) extensions.push(...preset.extensions);
          }
          extensions.push(...presetState.customExtensions);
        }

        if (extensions.length || raw['accept_max_size_mb']) {
          inp.accept = {};
          if (extensions.length) inp.accept.extensions = extensions;
          if (raw['accept_max_size_mb']) inp.accept.max_size_mb = raw['accept_max_size_mb'] as number;
        }
      }

      if (raw['source_text']) {
        const placeholder = raw['text_placeholder'] as string;
        const maxLength = raw['text_max_length'] as number;
        if (placeholder || maxLength) {
          inp.text_config = {};
          if (placeholder) inp.text_config.placeholder = placeholder;
          if (maxLength) inp.text_config.max_length = maxLength;
        }
      }

      return inp;
    });

    this.stateChange.emit({ inputs });
  }

  // M3: Validate that every input has at least one source type selected
  private hasSourceValidationError(): boolean {
    for (let i = 0; i < this.inputsArray.length; i++) {
      const group = this.inputsArray.at(i) as FormGroup;
      const hasAsset = group.get('source_asset')?.value;
      const hasUpload = group.get('source_upload')?.value;
      const hasText = group.get('source_text')?.value;
      if (!hasAsset && !hasUpload && !hasText) {
        return true;
      }
    }
    return false;
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    const hasSourceError = this.hasSourceValidationError();
    this.sourceError.set(hasSourceError ? 'Each input must have at least one source type selected' : null);
    return this.form.valid
      && this.subjectCount() === 1
      && this.duplicateNames().length === 0
      && !hasSourceError;
  }
}
