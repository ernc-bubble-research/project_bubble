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
  createdAt: new Date(),
  updatedAt: new Date(),
};

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

    await TestBed.configureTestingModule({
      imports: [TestHostComponent, LlmModelFormDialogComponent],
      providers: [
        { provide: LlmModelService, useValue: mockLlmModelService },
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

  it('[3.1-3-UNIT-026] should show read-only hint for providerKey in edit mode', async () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.componentInstance.model.set(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('cannot be changed');
  });
});
