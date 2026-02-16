import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { LucideIconProvider, LUCIDE_ICONS, Info, ChevronDown, ChevronUp, RotateCcw } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { WorkflowDefinition } from '@project-bubble/shared';
import { WizardExecutionStepComponent } from './wizard-execution-step.component';
import { LlmModelService, LlmModel } from '../../../../core/services/llm-model.service';
import { ProviderTypeService } from '../../../../core/services/provider-type.service';

const mockParams = [
  { key: 'temperature', label: 'Temperature', type: 'number' as const, min: 0, max: 2, default: 0.7 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number' as const, min: 1, max: 65536, default: 4096 },
  { key: 'topP', label: 'Top P', type: 'number' as const, min: 0, max: 1, default: 1.0 },
];

const googleParams = [
  ...mockParams,
  { key: 'topK', label: 'Top K', type: 'number' as const, min: 1, max: 100, default: 40 },
];

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
  generationDefaults: null,
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
  generationDefaults: { temperature: 0.3, topP: 0.9 },
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

    const mockProviderTypeService = {
      types: signal([
        { providerKey: 'mock', displayName: 'Mock Provider', credentialFields: [], supportedGenerationParams: mockParams, isDevelopmentOnly: true },
        { providerKey: 'google-ai-studio', displayName: 'Google AI Studio', credentialFields: [], supportedGenerationParams: googleParams, isDevelopmentOnly: false },
      ]),
      getProviderTypes: jest.fn().mockReturnValue(of([])),
      getDisplayName: jest.fn((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [WizardExecutionStepComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Info, ChevronDown, ChevronUp, RotateCcw }),
        },
        { provide: LlmModelService, useValue: mockLlmModelService },
        { provide: ProviderTypeService, useValue: mockProviderTypeService },
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

  it('[4.2-UNIT-060] should build dynamic generation params form on model load', () => {
    createComponent();
    // Model A is mock provider — should have temperature, maxOutputTokens, topP (3 params minus stopSequences)
    expect(component.basicParams().length).toBe(2); // temperature, maxOutputTokens
    expect(component.advancedParams().length).toBe(1); // topP
  });

  it('[4.2-UNIT-061] should mark form invalid when model is empty', () => {
    createComponent();
    component.form.patchValue({ model: '' });
    expect(component.isValid()).toBe(false);
  });

  it('[4.2-UNIT-062] should mark form valid when model is selected', () => {
    createComponent();
    expect(component.isValid()).toBe(true);
  });

  it('[4.2-UNIT-063] should reject generation param outside range', () => {
    createComponent();
    component.generationParamsForm.get('temperature')?.setValue(3);
    expect(component.generationParamsForm.get('temperature')?.hasError('max')).toBe(true);

    component.generationParamsForm.get('temperature')?.setValue(-1);
    expect(component.generationParamsForm.get('temperature')?.hasError('min')).toBe(true);
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

  describe('Dynamic generation params (4-GP)', () => {
    it('[4-GP-UNIT-023] should populate generation params from existing state', () => {
      createComponent({
        execution: {
          processing: 'parallel',
          model: 'uuid-model-b',
          temperature: 0.5,
          max_output_tokens: 2048,
          top_p: 0.8,
        },
      });
      // Model B is google-ai-studio — should load existing values
      expect(component.generationParamsForm.get('temperature')?.value).toBe(0.5);
      expect(component.generationParamsForm.get('maxOutputTokens')?.value).toBe(2048);
      expect(component.generationParamsForm.get('topP')?.value).toBe(0.8);
    });

    it('[4-GP-UNIT-024] should nuclear reset params when model changes', () => {
      createComponent({
        execution: {
          processing: 'parallel',
          model: 'uuid-model-b',
          temperature: 0.5,
        },
      });
      expect(component.generationParamsForm.get('temperature')?.value).toBe(0.5);

      // Change model to A
      component.form.patchValue({ model: 'uuid-model-a' });
      // Nuclear reset — all params should be null
      expect(component.generationParamsForm.get('temperature')?.value).toBeNull();
    });

    it('[4-GP-UNIT-025] should show reset notification after model change', () => {
      createComponent();
      // Change model to B
      component.form.patchValue({ model: 'uuid-model-b' });
      expect(component.resetNotification()).toBe('Parameters reset to Gemini 1.5 Pro defaults');
    });

    it('[4-GP-UNIT-026] should clear all params on reset to defaults button', () => {
      createComponent({
        execution: {
          processing: 'parallel',
          model: 'uuid-model-a',
          temperature: 1.5,
        },
      });
      expect(component.generationParamsForm.get('temperature')?.value).toBe(1.5);

      component.onResetToDefaults();
      expect(component.generationParamsForm.get('temperature')?.value).toBeNull();
    });

    it('[4-GP-UNIT-027] should emit snake_case params in stateChange', () => {
      createComponent();
      const emitted: Partial<WorkflowDefinition>[] = [];
      const sub = component.stateChange.subscribe((v) => emitted.push(v));

      component.generationParamsForm.get('temperature')?.setValue(0.5);
      component.generationParamsForm.get('topP')?.setValue(0.9);

      const last = emitted[emitted.length - 1];
      expect(last.execution?.temperature).toBe(0.5);
      expect(last.execution?.top_p).toBe(0.9);
      sub.unsubscribe();
    });

    it('[4-GP-UNIT-028] should resolve default from model generationDefaults', () => {
      createComponent({
        execution: {
          processing: 'parallel',
          model: 'uuid-model-b',
        },
      });
      const tempParam = component.basicParams().find((p) => p.key === 'temperature')!;
      // Model B has generationDefaults.temperature = 0.3
      expect(component.getResolvedDefault(tempParam)).toBe('0.3');
    });

    it('[4-GP-UNIT-029] should fall back to spec default when no model default', () => {
      createComponent({
        execution: {
          processing: 'parallel',
          model: 'uuid-model-a',
        },
      });
      const tempParam = component.basicParams().find((p) => p.key === 'temperature')!;
      // Model A has no generationDefaults — falls back to spec default 0.7
      expect(component.getResolvedDefault(tempParam)).toBe('0.7');
    });

    it('[4-GP-UNIT-030] should toggle advanced section', () => {
      createComponent();
      expect(component.advancedOpen()).toBe(false);
      component.toggleAdvanced();
      expect(component.advancedOpen()).toBe(true);
      component.toggleAdvanced();
      expect(component.advancedOpen()).toBe(false);
    });

    it('[4-GP-UNIT-031] should rebuild params when switching to provider with different params', () => {
      createComponent();
      // Model A = mock (3 params: temperature, topP, maxOutputTokens)
      expect(component.basicParams().length).toBe(2);
      expect(component.advancedParams().length).toBe(1);

      // Switch to Model B = google-ai-studio (4 params: + topK)
      component.form.patchValue({ model: 'uuid-model-b' });
      expect(component.basicParams().length).toBe(2);
      expect(component.advancedParams().length).toBe(2); // topP + topK
    });
  });
});
