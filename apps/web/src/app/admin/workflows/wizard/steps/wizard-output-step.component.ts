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
  WorkflowOutputSection,
} from '@project-bubble/shared';
import { InfoTooltipComponent } from '../../../../shared/components/info-tooltip/info-tooltip.component';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, InfoTooltipComponent],
  selector: 'app-wizard-output-step',
  templateUrl: './wizard-output-step.component.html',
  styleUrl: './wizard-step-shared.scss',
})
export class WizardOutputStepComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  state = input.required<Partial<WorkflowDefinition>>();
  stateChange = output<Partial<WorkflowDefinition>>();

  form!: FormGroup;
  jsonError = signal<string | null>(null);
  previewOpen = signal(false);

  // L2: These remain getters (not computed signals) because they read from
  // Reactive Forms values which are not Angular signals.
  get sectionsArray(): FormArray {
    return this.form.get('sections') as FormArray;
  }
  get isMarkdown(): boolean {
    return this.form?.get('format')?.value === 'markdown';
  }
  get isJson(): boolean {
    return this.form?.get('format')?.value === 'json';
  }

  /** Build preview data from full wizard state */
  previewData = computed(() => {
    const s = this.state();
    return {
      name: s?.metadata?.name || '(no name)',
      description: s?.metadata?.description || '(no description)',
      tags: s?.metadata?.tags?.join(', ') || '(none)',
      inputCount: String(s?.inputs?.length || 0),
      subjectCount: String(s?.inputs?.filter((i) => i.role === 'subject').length || 0),
      contextCount: String(s?.inputs?.filter((i) => i.role === 'context').length || 0),
      processing: s?.execution?.processing || '(not set)',
      model: s?.execution?.model || '(not set)',
      temperature: String(s?.execution?.temperature ?? ''),
      knowledgeEnabled: s?.knowledge?.enabled ? 'Yes' : 'No',
      promptSnippet: (s?.prompt || '').split('\n').slice(0, 3).join('\n') || '(empty)',
      outputFormat: s?.output?.format || '(not set)',
    };
  });

  ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    const out = this.state()?.output;
    const sections = out?.sections || [];

    this.form = this.fb.group({
      format: [out?.format || 'markdown'],
      filename_template: [out?.filename_template || '', [Validators.required]],
      sections: this.fb.array(
        sections.map((s) => this.createSectionGroup(s))
      ),
      json_schema: [out?.json_schema ? JSON.stringify(out.json_schema, null, 2) : ''],
    });

    // H2: takeUntilDestroyed prevents memory leak
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncToParent());
  }

  private createSectionGroup(section?: WorkflowOutputSection): FormGroup {
    return this.fb.group({
      name: [section?.name || '', [Validators.required]],
      label: [section?.label || '', [Validators.required]],
      required: [section?.required ?? true],
    });
  }

  addSection(): void {
    this.sectionsArray.push(this.createSectionGroup());
    this.syncToParent();
  }

  removeSection(index: number): void {
    this.sectionsArray.removeAt(index);
    this.syncToParent();
  }

  validateJson(): void {
    const raw = this.form.get('json_schema')?.value;
    if (!raw) {
      this.jsonError.set(null);
      return;
    }
    try {
      JSON.parse(raw);
      this.jsonError.set(null);
    } catch (e) {
      this.jsonError.set('Invalid JSON: ' + (e instanceof Error ? e.message : 'Parse error'));
    }
  }

  togglePreview(): void {
    this.previewOpen.update((v) => !v);
  }

  private syncToParent(): void {
    const val = this.form.value;
    const outputConfig: WorkflowDefinition['output'] = {
      format: val.format,
      filename_template: val.filename_template,
    };

    if (val.format === 'markdown') {
      outputConfig.sections = val.sections.map((s: Record<string, unknown>) => ({
        name: s['name'],
        label: s['label'],
        required: s['required'],
      }));
    }

    if (val.format === 'json' && val.json_schema) {
      try {
        outputConfig.json_schema = JSON.parse(val.json_schema);
      } catch {
        // Keep raw text, validation will catch it
      }
    }

    this.stateChange.emit({ output: outputConfig });
  }

  isValid(): boolean {
    this.form.markAllAsTouched();
    if (this.isJson) {
      this.validateJson();
      return this.form.valid && !this.jsonError();
    }
    return this.form.valid;
  }
}
