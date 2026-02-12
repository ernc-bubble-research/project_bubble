import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Info } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { WorkflowDefinition } from '@project-bubble/shared';
import { WizardExecutionStepComponent } from './wizard-execution-step.component';
import { LlmModelService, LlmModel } from '../../../../core/services/llm-model.service';

const MODEL_A: LlmModel = {
  id: 'uuid-model-a',
  providerKey: 'mock',
  modelId: 'mock-model-a',
  displayName: 'Mock Model A',
  contextWindow: 100000,
  maxOutputTokens: 8192,
  isActive: true,
  costPer1kInput: null,
  costPer1kOutput: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MODEL_B: LlmModel = {
  id: 'uuid-model-b',
  providerKey: 'google-ai-studio',
  modelId: 'gemini-1.5-pro',
  displayName: 'Gemini 1.5 Pro',
  contextWindow: 1000000,
  maxOutputTokens: 8192,
  isActive: true,
  costPer1kInput: '0.000150',
  costPer1kOutput: '0.000600',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('[P0] WizardExecutionStepComponent', () => {
  let component: WizardExecutionStepComponent;
  let fixture: ComponentFixture<WizardExecutionStepComponent>;
  let mockLlmModelService: { getActiveModels: jest.Mock };

  const defaultState: Partial<WorkflowDefinition> = {};

  function createComponent(state: Partial<WorkflowDefinition> = defaultState) {
    fixture = TestBed.createComponent(WizardExecutionStepComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    mockLlmModelService = {
      getActiveModels: jest.fn().mockReturnValue(of([MODEL_A, MODEL_B])),
    };

    await TestBed.configureTestingModule({
      imports: [WizardExecutionStepComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Info }),
        },
        { provide: LlmModelService, useValue: mockLlmModelService },
      ],
    }).compileComponents();
  });

  it('[4.2-UNIT-053] should create the execution step component', () => {
    createComponent();
    expect(component).toBeTruthy();
  });

  it('[4.2-UNIT-054] should load active models on init', () => {
    createComponent();
    expect(mockLlmModelService.getActiveModels).toHaveBeenCalled();
    expect(component.models().length).toBe(2);
    expect(component.modelsLoading()).toBe(false);
  });

  it('[4.2-UNIT-055] should auto-select first model UUID when no model set', () => {
    createComponent();
    expect(component.form.get('model')?.value).toBe('uuid-model-a');
  });

  it('[4.2-UNIT-056] should bind model dropdown value to model.id (UUID), not modelId', () => {
    createComponent();
    // The form value should be a UUID, not a provider model string
    const modelValue = component.form.get('model')?.value;
    expect(modelValue).toBe('uuid-model-a');
    expect(modelValue).not.toBe('mock-model-a');
  });

  it('[4.2-UNIT-057] should preserve existing model UUID from state', () => {
    createComponent({
      execution: {
        processing: 'parallel',
        model: 'uuid-model-b',
        temperature: 0.5,
        max_output_tokens: 2048,
      },
    });
    // Should NOT auto-select — keeps existing value
    expect(component.form.get('model')?.value).toBe('uuid-model-b');
  });

  it('[4.2-UNIT-058] should set modelsLoadError on service failure', () => {
    mockLlmModelService.getActiveModels.mockReturnValue(
      throwError(() => new Error('Network error')),
    );
    createComponent();
    expect(component.modelsLoadError()).toBe(
      'Failed to load LLM models. Please refresh the page.',
    );
    expect(component.modelsLoading()).toBe(false);
  });

  it('[4.2-UNIT-059] should emit UUID model value in stateChange', () => {
    createComponent();
    const emitted: Partial<WorkflowDefinition>[] = [];
    const sub = component.stateChange.subscribe((v) => emitted.push(v));

    component.form.patchValue({ model: 'uuid-model-b' });

    const last = emitted[emitted.length - 1];
    expect(last.execution?.model).toBe('uuid-model-b');
    sub.unsubscribe();
  });

  it('[4.2-UNIT-060] should initialize with default temperature and max_output_tokens', () => {
    createComponent();
    expect(component.form.get('temperature')?.value).toBe(0.7);
    expect(component.form.get('max_output_tokens')?.value).toBe(4096);
  });

  it('[4.2-UNIT-061] should mark form invalid when model is empty', () => {
    createComponent();
    component.form.patchValue({ model: '' });
    expect(component.isValid()).toBe(false);
  });

  it('[4.2-UNIT-062] should mark form valid when model is selected', () => {
    createComponent();
    // Model is auto-selected
    expect(component.isValid()).toBe(true);
  });

  it('[4.2-UNIT-063] should reject temperature outside 0-2 range', () => {
    createComponent();
    component.form.patchValue({ temperature: 3 });
    expect(component.form.get('temperature')?.hasError('max')).toBe(true);

    component.form.patchValue({ temperature: -1 });
    expect(component.form.get('temperature')?.hasError('min')).toBe(true);
  });

  it('[4.2-UNIT-064] should set processing mode from state', () => {
    createComponent({
      execution: {
        processing: 'batch',
        model: 'uuid-model-a',
      },
    });
    expect(component.form.get('processing')?.value).toBe('batch');
  });
});
