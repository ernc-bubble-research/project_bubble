import {
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
  OnInit,
  HostListener,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { switchMap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import type { WorkflowDefinition } from '@project-bubble/shared';
import { validateWorkflowDefinition } from '@project-bubble/shared/web';
import { WorkflowTemplateService } from '../../../core/services/workflow-template.service';
import { ToastService } from '../../../core/services/toast.service';
import { HasUnsavedChanges } from '../../../core/guards/has-unsaved-changes.interface';
import { WizardMetadataStepComponent } from './steps/wizard-metadata-step.component';
import { WizardInputsStepComponent } from './steps/wizard-inputs-step.component';
import { WizardExecutionStepComponent } from './steps/wizard-execution-step.component';
// Knowledge step deferred to Phase 2 (see Epic 3 retrospective discussion item #8)
import { WizardPromptStepComponent } from './steps/wizard-prompt-step.component';
import { WizardOutputStepComponent } from './steps/wizard-output-step.component';

export interface WizardStep {
  label: string;
  icon: string;
}

@Component({
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    WizardMetadataStepComponent,
    WizardInputsStepComponent,
    WizardExecutionStepComponent,
    WizardPromptStepComponent,
    WizardOutputStepComponent,
  ],
  selector: 'app-workflow-wizard',
  templateUrl: './workflow-wizard.component.html',
  styleUrl: './workflow-wizard.component.scss',
})
export class WorkflowWizardComponent implements OnInit, HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templateService = inject(WorkflowTemplateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  // H1: viewChild refs for per-step validation
  private readonly metadataStep = viewChild(WizardMetadataStepComponent);
  private readonly inputsStep = viewChild(WizardInputsStepComponent);
  private readonly executionStep = viewChild(WizardExecutionStepComponent);
  private readonly promptStep = viewChild(WizardPromptStepComponent);
  private readonly outputStep = viewChild(WizardOutputStepComponent);

  // Knowledge step deferred to Phase 2 (see Epic 3 retrospective item #8)
  steps: WizardStep[] = [
    { label: 'Metadata', icon: 'file-text' },
    { label: 'Inputs', icon: 'layers' },
    { label: 'Execution', icon: 'zap' },
    { label: 'Prompt', icon: 'message-square' },
    { label: 'Output', icon: 'file-output' },
  ];

  currentStep = signal(0);
  highestVisitedStep = signal(0);
  isDirty = signal(false);
  isSaving = signal(false);
  saveError = signal<string | null>(null);
  validationErrors = signal<string[]>([]);
  stepValidationError = signal<string | null>(null);

  editMode = signal(false);
  templateId = signal<string | null>(null);

  wizardState = signal<Partial<WorkflowDefinition>>({
    metadata: { name: '', description: '', version: 1, tags: [] },
    inputs: [],
    execution: {
      processing: 'parallel',
      model: '',
      temperature: 0.7,
      max_output_tokens: 4096,
    },
    knowledge: { enabled: false },
    prompt: '',
    output: {
      format: 'markdown',
      filename_template: '',
      sections: [],
    },
  });

  isFirstStep = computed(() => this.currentStep() === 0);
  isLastStep = computed(() => this.currentStep() === this.steps.length - 1);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editMode.set(true);
      this.templateId.set(id);
      this.loadExistingTemplate(id);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.isDirty()) {
      event.preventDefault();
    }
  }

  updateState(partial: Partial<WorkflowDefinition>): void {
    this.wizardState.update((state) => ({ ...state, ...partial }));
    this.isDirty.set(true);
  }

  goToStep(index: number): void {
    if (index <= this.highestVisitedStep() && index >= 0 && index < this.steps.length) {
      this.stepValidationError.set(null);
      this.currentStep.set(index);
    }
  }

  // H1: nextStep now calls isCurrentStepValid() instead of receiving hardcoded true
  nextStep(): void {
    if (!this.isCurrentStepValid()) {
      this.stepValidationError.set('Please fix the errors before proceeding.');
      return;
    }
    this.stepValidationError.set(null);
    const next = this.currentStep() + 1;
    if (next < this.steps.length) {
      this.currentStep.set(next);
      if (next > this.highestVisitedStep()) {
        this.highestVisitedStep.set(next);
      }
    }
  }

  prevStep(): void {
    this.stepValidationError.set(null);
    const prev = this.currentStep() - 1;
    if (prev >= 0) {
      this.currentStep.set(prev);
    }
  }

  save(): void {
    const state = this.wizardState();
    // validateWorkflowDefinition performs full runtime validation of all required fields
    const result = validateWorkflowDefinition(state as WorkflowDefinition);

    if (!result.valid) {
      this.validationErrors.set(result.errors);
      this.navigateToFirstErrorStep(result.errors);
      return;
    }

    // After validation passes, state is guaranteed to have all required fields
    const definition = state as WorkflowDefinition;

    this.validationErrors.set([]);
    this.isSaving.set(true);
    this.saveError.set(null);

    const id = this.templateId();
    if (this.editMode() && id) {
      this.templateService
        .createVersion(id, { definition: definition as unknown as Record<string, unknown> })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.isSaving.set(false);
            this.isDirty.set(false);
            this.toast.show('Workflow version created successfully');
            this.router.navigate(['/admin/workflows']);
          },
          error: (err: { error?: { message?: string } }) => {
            this.isSaving.set(false);
            this.saveError.set(err?.error?.message || 'Failed to save workflow version');
          },
        });
    } else {
      this.createNewWorkflow(definition);
    }
  }

  // H3: Replaced triple-nested subscribe with switchMap/catchError
  private createNewWorkflow(definition: WorkflowDefinition): void {
    const meta = definition.metadata;
    let createdTemplateId: string;

    this.templateService
      .create({ name: meta.name, description: meta.description, visibility: 'public' })
      .pipe(
        switchMap((template) => {
          createdTemplateId = template.id;
          return this.templateService
            .createVersion(template.id, { definition: definition as unknown as Record<string, unknown> })
            .pipe(
              catchError((versionErr: { error?: { message?: string } }) =>
                this.templateService.delete(createdTemplateId).pipe(
                  switchMap(() =>
                    throwError(() =>
                      new Error('Failed to create workflow version. The template was cleaned up. Please try again.')
                    )
                  ),
                  catchError(() =>
                    throwError(() =>
                      new Error(
                        `Failed to create workflow version. An orphaned template (${createdTemplateId}) may exist. Error: ${versionErr?.error?.message || 'Unknown error'}`
                      )
                    )
                  )
                )
              )
            );
        })
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSaving.set(false);
          this.isDirty.set(false);
          this.toast.show('Workflow template created successfully');
          this.router.navigate(['/admin/workflows']);
        },
        error: (err: Error & { error?: { message?: string } }) => {
          this.isSaving.set(false);
          this.saveError.set(err?.message || err?.error?.message || 'Failed to create workflow template');
        },
      });
  }

  private loadExistingTemplate(id: string): void {
    this.templateService.getById(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (template) => {
        if (template.currentVersion?.definition) {
          const def = template.currentVersion.definition as unknown as WorkflowDefinition;
          const result = validateWorkflowDefinition(def);
          if (result.valid) {
            this.wizardState.set(def);
            this.highestVisitedStep.set(this.steps.length - 1);
          } else {
            this.saveError.set(
              `Stored definition has validation issues: ${result.errors.join(', ')}`
            );
            this.wizardState.set(def);
            this.highestVisitedStep.set(this.steps.length - 1);
          }
        }
      },
      error: () => {
        this.saveError.set('Failed to load workflow template');
      },
    });
  }

  // H1: Validate current step by calling child component's isValid()
  // Note: Knowledge step (was case 3) deferred to Phase 2
  private isCurrentStepValid(): boolean {
    switch (this.currentStep()) {
      case 0: return this.metadataStep()?.isValid() ?? false;
      case 1: return this.inputsStep()?.isValid() ?? false;
      case 2: return this.executionStep()?.isValid() ?? false;
      case 3: return this.promptStep()?.isValid() ?? false;
      case 4: return this.outputStep()?.isValid() ?? false;
      default: return false;
    }
  }

  // M4: Structured keyword-to-step mapping instead of fragile if-else chain
  // Note: Knowledge step removed (deferred to Phase 2)
  private navigateToFirstErrorStep(errors: string[]): void {
    const stepKeywords: string[][] = [
      ['metadata', 'name', 'description', 'tags'],
      ['input', 'subject'],
      ['execution', 'model', 'temperature', 'processing'],
      ['prompt'],
      ['output', 'filename', 'section', 'json_schema'],
    ];

    const errorText = errors.join(' ').toLowerCase();
    for (let i = 0; i < stepKeywords.length; i++) {
      if (stepKeywords[i].some((keyword) => errorText.includes(keyword))) {
        this.currentStep.set(i);
        return;
      }
    }
  }

  cancel(): void {
    this.router.navigate(['/admin/workflows']);
  }
}
