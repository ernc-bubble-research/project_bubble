import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-angular';
import { LlmModelFormDialogComponent } from './llm-model-form-dialog.component';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';

const mockModel: LlmModel = {
  id: 'model-1',
  providerKey: 'google-ai-studio',
  modelId: 'models/gemini-2.0-flash',
  displayName: 'Gemini 2.0 Flash',
  contextWindow: 1000000,
  maxOutputTokens: 8192,
  isActive: true,
  costPer1kInput: '0.000150',
  costPer1kOutput: '0.000600',
  generationDefaults: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const googleParams = [
  { key: 'temperature', label: 'Temperature', type: 'number' as const, min: 0, max: 2, default: 1.0 },
  { key: 'topP', label: 'Top P', type: 'number' as const, min: 0, max: 1, default: 0.95 },
  { key: 'topK', label: 'Top K', type: 'number' as const, min: 1, max: 100, default: 40 },
  { key: 'maxOutputTokens', label: 'Max Output Tokens', type: 'number' as const, min: 1, max: 8192, default: 8192 },
];

// Test host component to handle input.required via signal input
@Component({
  standalone: true,
  imports: [LlmModelFormDialogComponent],
  template: `
    <app-llm-model-form-dialog
      [model]="model()"
      (saved)="onSaved($event)"
      (cancelled)="onCancelled()"
    ></app-llm-model-form-dialog>
  `,
})
class TestHostComponent {
  model = signal<LlmModel | null>(null);
  savedModel: LlmModel | null = null;
  cancelled = false;

  onSaved(model: LlmModel): void {
    this.savedModel = model;
  }

  onCancelled(): void {
    this.cancelled = true;
  }
}

describe('LlmModelFormDialogComponent [P2]', () => {
  let mockLlmModelService: {
    createModel: jest.Mock;
    updateModel: jest.Mock;
  };

  beforeEach(async () => {
    mockLlmModelService = {
      createModel: jest.fn().mockReturnValue(of(mockModel)),
      updateModel: jest.fn().mockReturnValue(of(mockModel)),
    };

    const mockProviderTypeService = {
      types: signal([
        { providerKey: 'google-ai-studio', displayName: 'Google AI Studio', credentialFields: [], supportedGenerationParams: googleParams, isDevelopmentOnly: false },
        { providerKey: 'mock', displayName: 'Mock Provider', credentialFields: [], supportedGenerationParams: [googleParams[0], googleParams[1], googleParams[3]], isDevelopmentOnly: true },
        { providerKey: 'vertex', displayName: 'Vertex AI', credentialFields: [], supportedGenerationParams: googleParams, isDevelopmentOnly: false },
        { providerKey: 'openai', displayName: 'OpenAI', credentialFields: [], supportedGenerationParams: [googleParams[0], googleParams[1], googleParams[3]], isDevelopmentOnly: false },
      ]),
      getProviderTypes: jest.fn().mockReturnValue(of([])),
      getDisplayName: jest.fn((key: string) => key),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, LlmModelFormDialogComponent],
      providers: [
        { provide: LlmModelService, useValue: mockLlmModelService },
        { provide: ProviderTypeService, useValue: mockProviderTypeService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ X, AlertCircle, Loader2 }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-3-UNIT-016] should create in add mode', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Add LLM Model');
  });

  it('[3.1-3-UNIT-017] should create in edit mode with pre-filled values', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.model.set(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Edit LLM Model');

    const displayNameInput = fixture.nativeElement.querySelector(
      '[data-testid="input-displayName"]'
    ) as HTMLInputElement;
    expect(displayNameInput.value).toBe('Gemini 2.0 Flash');
  });

  it('[3.1-3-UNIT-018] should disable providerKey and modelId in edit mode', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.model.set(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const providerInput = fixture.nativeElement.querySelector(
      '[data-testid="input-providerKey"]'
    ) as HTMLInputElement;
    const modelIdInput = fixture.nativeElement.querySelector(
      '[data-testid="input-modelId"]'
    ) as HTMLInputElement;

    expect(providerInput.disabled || providerInput.readOnly).toBe(true);
    expect(modelIdInput.disabled || modelIdInput.readOnly).toBe(true);
  });

  it('[3.1-3-UNIT-019] should validate required fields', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]');
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    // Should show validation errors, not call create
    expect(mockLlmModelService.createModel).not.toHaveBeenCalled();
  });

  it('[3.1-3-UNIT-020] should call createModel on valid add form submit', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    // Fill out the form via the component's form directly
    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      modelId: 'models/gemini-2.0-flash',
      displayName: 'Gemini 2.0 Flash',
      contextWindow: 1000000,
      maxOutputTokens: 8192,
    });
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]');
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.createModel).toHaveBeenCalled();
    expect(fixture.componentInstance.savedModel).toEqual(mockModel);
  });

  it('[3.1-3-UNIT-021] should call updateModel on valid edit form submit', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.model.set(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Update via the form
    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    dialogComponent.form.patchValue({ displayName: 'Updated Name' });
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]');
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.updateModel).toHaveBeenCalledWith(
      'model-1',
      expect.objectContaining({ displayName: 'Updated Name' })
    );
  });

  it('[3.1-3-UNIT-022] should show error for 409 conflict', async () => {
    mockLlmModelService.createModel.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 }))
    );

    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    // Fill minimal valid form
    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      modelId: 'models/gemini-2.0-flash',
      displayName: 'Test',
      contextWindow: 1000,
      maxOutputTokens: 100,
    });
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]');
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="form-error"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('already exists');
  });

  it('[3.1-3-UNIT-023] should emit cancelled when cancel button clicked', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const cancelBtn = fixture.nativeElement.querySelector('[data-testid="cancel-btn"]');
    cancelBtn.click();

    expect(fixture.componentInstance.cancelled).toBe(true);
  });

  it('[3.1-3-UNIT-024] should emit cancelled when backdrop clicked', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const backdrop = fixture.nativeElement.querySelector('[data-testid="form-dialog-backdrop"]');
    backdrop.click();

    expect(fixture.componentInstance.cancelled).toBe(true);
  });

  it('[3.1-3-UNIT-025] should show provider dropdown options in add mode', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const providerSelect = fixture.nativeElement.querySelector(
      '[data-testid="input-providerKey"]'
    ) as HTMLSelectElement;

    expect(providerSelect.tagName).toBe('SELECT');
    expect(providerSelect.options.length).toBeGreaterThan(1); // placeholder + providers
  });

  it('[4-FIX-B-UNIT-016] should default isActive to false in add mode (configure first, then activate)', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    expect(dialogComponent.form.value.isActive).toBe(false);
  });

  it('[4-GP-UNIT-020] should show generation defaults section when provider is selected', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    dialogComponent.form.patchValue({ providerKey: 'google-ai-studio' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const section = fixture.nativeElement.querySelector('[data-testid="generation-defaults-section"]');
    expect(section).toBeTruthy();
    expect(dialogComponent.selectedProviderParams().length).toBe(4); // temperature, topP, topK, maxOutputTokens (stopSequences filtered)
  });

  it('[4-GP-UNIT-021] should populate generation defaults from model in edit mode', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    const modelWithDefaults = { ...mockModel, generationDefaults: { temperature: 0.5, topP: 0.8 } };
    fixture.componentInstance.model.set(modelWithDefaults);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    expect(dialogComponent.generationDefaultsForm.get('temperature')?.value).toBe(0.5);
    expect(dialogComponent.generationDefaultsForm.get('topP')?.value).toBe(0.8);
  });

  it('[4-GP-UNIT-022] should include generationDefaults in create DTO on submit', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      modelId: 'models/test',
      displayName: 'Test',
      contextWindow: 1000,
      maxOutputTokens: 100,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Set a generation default
    dialogComponent.generationDefaultsForm.get('temperature')?.setValue(0.3);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]');
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.createModel).toHaveBeenCalledWith(
      expect.objectContaining({ generationDefaults: { temperature: 0.3 } }),
    );
  });

  it('[4-GP-UNIT-047] should block submit when generationDefaults are invalid', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    dialogComponent.form.patchValue({
      providerKey: 'google-ai-studio',
      modelId: 'models/test',
      displayName: 'Test',
      contextWindow: 1000,
      maxOutputTokens: 100,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    // Set an invalid generation default (temperature max is 2)
    dialogComponent.generationDefaultsForm.get('temperature')?.setValue(5);
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('[data-testid="submit-btn"]');
    submitBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.createModel).not.toHaveBeenCalled();
  });

  it('[4-GP-UNIT-059] should show empty generation defaults form when model has null generationDefaults', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    // mockModel already has generationDefaults: null
    fixture.componentInstance.model.set(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialogComponent = fixture.debugElement.children[0].componentInstance as LlmModelFormDialogComponent;
    // Provider is google-ai-studio → should have generation params form controls
    expect(dialogComponent.selectedProviderParams().length).toBe(4);
    // All generation defaults controls should be null (no pre-filled values)
    expect(dialogComponent.generationDefaultsForm.get('temperature')?.value).toBeNull();
    expect(dialogComponent.generationDefaultsForm.get('topP')?.value).toBeNull();
    expect(dialogComponent.generationDefaultsForm.get('topK')?.value).toBeNull();
    expect(dialogComponent.generationDefaultsForm.get('maxOutputTokens')?.value).toBeNull();
  });

  it('[3.1-3-UNIT-026] should show read-only hint for providerKey in edit mode', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.model.set(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('cannot be changed');
  });
});
