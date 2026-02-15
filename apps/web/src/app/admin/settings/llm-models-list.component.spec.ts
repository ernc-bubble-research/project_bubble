import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError, Subject } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Plus,
  AlertCircle,
  Brain,
  Server,
  Pencil,
  Loader2,
} from 'lucide-angular';
import { LlmModelsListComponent } from './llm-models-list.component';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';

const mockModels: LlmModel[] = [
  {
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
  },
  {
    id: 'model-2',
    providerKey: 'google-ai-studio',
    modelId: 'models/gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    isActive: false,
    costPer1kInput: null,
    costPer1kOutput: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'model-3',
    providerKey: 'mock',
    modelId: 'mock-model',
    displayName: 'Mock Model',
    contextWindow: 4096,
    maxOutputTokens: 1024,
    isActive: true,
    costPer1kInput: null,
    costPer1kOutput: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('LlmModelsListComponent [P2]', () => {
  let mockLlmModelService: {
    getAllModels: jest.Mock;
    updateModel: jest.Mock;
    bulkUpdateStatus: jest.Mock;
  };

  beforeEach(async () => {
    mockLlmModelService = {
      getAllModels: jest.fn().mockReturnValue(of(mockModels)),
      updateModel: jest.fn(),
      bulkUpdateStatus: jest.fn(),
    };

    const mockProviderTypeService = {
      types: signal([
        { providerKey: 'google-ai-studio', displayName: 'Google AI Studio', credentialFields: [], isDevelopmentOnly: false },
        { providerKey: 'mock', displayName: 'Mock Provider', credentialFields: [], isDevelopmentOnly: true },
      ]),
      getProviderTypes: jest.fn().mockReturnValue(of([])),
      getDisplayName: jest.fn((key: string) => {
        const names: Record<string, string> = { 'google-ai-studio': 'Google AI Studio', mock: 'Mock Provider' };
        return names[key] ?? key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [LlmModelsListComponent],
      providers: [
        { provide: LlmModelService, useValue: mockLlmModelService },
        { provide: ProviderTypeService, useValue: mockProviderTypeService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Plus,
            AlertCircle,
            Brain,
            Server,
            Pencil,
            Loader2,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-3-UNIT-005] should create', () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[3.1-3-UNIT-006] should render model list on load', async () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="llm-models-list"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="provider-groups"]')).toBeTruthy();
  });

  it('[3.1-3-UNIT-007] should show loading skeleton while loading', async () => {
    // Use a Subject to control when the observable emits
    const modelsSubject = new Subject<LlmModel[]>();
    mockLlmModelService.getAllModels.mockReturnValue(modelsSubject.asObservable());

    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();

    // While waiting for response, loading should be true
    expect(fixture.componentInstance.loading()).toBe(true);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="loading-skeleton"]')).toBeTruthy();

    // Complete the observable
    modelsSubject.next([]);
    modelsSubject.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    // Now loading should be false
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('[3.1-3-UNIT-008] should show empty state when no models', async () => {
    mockLlmModelService.getAllModels.mockReturnValue(of([]));
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="empty-state"]')).toBeTruthy();
    expect(el.textContent).toContain('No models configured');
  });

  it('[3.1-3-UNIT-009] should show error banner on API failure', async () => {
    mockLlmModelService.getAllModels.mockReturnValue(
      throwError(() => new Error('API Error'))
    );
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-banner"]')).toBeTruthy();
    expect(el.textContent).toContain('Failed to load LLM models');
  });

  it('[3.1-3-UNIT-010] should group models by provider', async () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="provider-group-google-ai-studio"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="provider-group-mock"]')).toBeTruthy();
  });

  it('[3.1-3-UNIT-011] should emit addModelClicked when Add Model button clicked', async () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const spy = jest.fn();
    fixture.componentInstance.addModelClicked.subscribe(spy);

    const addBtn = fixture.nativeElement.querySelector('[data-testid="add-model-btn"]');
    addBtn.click();

    expect(spy).toHaveBeenCalled();
  });

  it('[3.1-3-UNIT-012] should emit editModelClicked when edit button clicked', async () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const spy = jest.fn();
    fixture.componentInstance.editModelClicked.subscribe(spy);

    const editBtn = fixture.nativeElement.querySelector('[data-testid="edit-model-1"]');
    editBtn.click();

    expect(spy).toHaveBeenCalledWith(mockModels[0]);
  });

  it('[3.1-3-UNIT-013] should toggle model active status', async () => {
    const updatedModel = { ...mockModels[0], isActive: false };
    mockLlmModelService.updateModel.mockReturnValue(of(updatedModel));

    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toggleBtn = fixture.nativeElement.querySelector('[data-testid="toggle-model-1"]');
    toggleBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.updateModel).toHaveBeenCalledWith('model-1', {
      isActive: false,
    });
  });

  it('[3.1-3-UNIT-014] should format context window correctly', () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    const component = fixture.componentInstance;

    expect(component.formatContextWindow(1000000)).toBe('1.0M');
    expect(component.formatContextWindow(2000000)).toBe('2.0M');
    expect(component.formatContextWindow(8192)).toBe('8K');
    expect(component.formatContextWindow(500)).toBe('500');
  });

  it('[3.1-3-UNIT-015] should display provider display names', async () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Google AI Studio');
    expect(el.textContent).toContain('Mock Provider');
  });

  it('[4-FIX-B-UNIT-012] should render bulk activate/deactivate buttons per provider group', async () => {
    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="bulk-activate-google-ai-studio"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="bulk-deactivate-google-ai-studio"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="bulk-activate-mock"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="bulk-deactivate-mock"]')).toBeTruthy();
  });

  it('[4-FIX-B-UNIT-013] should call bulkUpdateStatus and update local models on bulk deactivate', async () => {
    mockLlmModelService.bulkUpdateStatus.mockReturnValue(of({ affected: 2 }));

    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const deactivateBtn = fixture.nativeElement.querySelector(
      '[data-testid="bulk-deactivate-google-ai-studio"]'
    );
    deactivateBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.bulkUpdateStatus).toHaveBeenCalledWith({
      providerKey: 'google-ai-studio',
      isActive: false,
    });

    // Verify models for google-ai-studio are now inactive in local state
    const googleModels = fixture.componentInstance.models().filter(
      (m) => m.providerKey === 'google-ai-studio'
    );
    expect(googleModels.every((m) => !m.isActive)).toBe(true);

    // Mock provider model should be unaffected
    const mockProviderModel = fixture.componentInstance.models().find(
      (m) => m.providerKey === 'mock'
    );
    expect(mockProviderModel!.isActive).toBe(true);
  });

  it('[4-FIX-B-UNIT-014] should show error banner on bulk update failure', async () => {
    mockLlmModelService.bulkUpdateStatus.mockReturnValue(
      throwError(() => new Error('Bulk update failed'))
    );

    const fixture = TestBed.createComponent(LlmModelsListComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const deactivateBtn = fixture.nativeElement.querySelector(
      '[data-testid="bulk-deactivate-google-ai-studio"]'
    );
    deactivateBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="error-banner"]')).toBeTruthy();
    expect(el.textContent).toContain('Failed to bulk update model status');
  });
});
