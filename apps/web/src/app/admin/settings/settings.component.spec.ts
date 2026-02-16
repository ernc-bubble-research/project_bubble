import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Settings,
  Brain,
  Plus,
  AlertCircle,
  AlertTriangle,
  Server,
  Pencil,
  Loader2,
  X,
  Key,
  Lock,
  LockOpen,
  Info,
} from 'lucide-angular';
import { SettingsComponent } from './settings.component';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';
import { LlmProviderService } from '../../core/services/llm-provider.service';
import { ProviderTypeService } from '../../core/services/provider-type.service';

const mockModel: LlmModel = {
  id: 'model-1',
  providerKey: 'google-ai-studio',
  modelId: 'models/gemini-2.0-flash',
  displayName: 'Gemini 2.0 Flash',
  contextWindow: 1000000,
  maxOutputTokens: 8192,
  isActive: true,
  costPer1kInput: null,
  costPer1kOutput: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockModel2: LlmModel = {
  id: 'model-2',
  providerKey: 'openai',
  modelId: 'gpt-4',
  displayName: 'GPT-4',
  contextWindow: 128000,
  maxOutputTokens: 4096,
  isActive: true,
  costPer1kInput: null,
  costPer1kOutput: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SettingsComponent [P2]', () => {
  const mockLlmModelService = {
    getAllModels: jest.fn().mockReturnValue(of([mockModel, mockModel2])),
    createModel: jest.fn().mockReturnValue(of(mockModel)),
    updateModel: jest.fn().mockReturnValue(of(mockModel)),
    getAffectedWorkflows: jest.fn().mockReturnValue(of([])),
    deactivateModel: jest.fn().mockReturnValue(of({ versionsReassigned: 0, deactivatedModelId: 'model-1', replacementModelId: 'model-2' })),
  };

  const mockLlmProviderService = {
    getAllConfigs: jest.fn().mockReturnValue(of([])),
    createConfig: jest.fn().mockReturnValue(of({})),
    updateConfig: jest.fn().mockReturnValue(of({})),
    getAffectedWorkflows: jest.fn().mockReturnValue(of([])),
    deactivateProvider: jest.fn().mockReturnValue(of([])),
  };

  beforeEach(async () => {
    mockLlmModelService.getAllModels.mockReturnValue(of([mockModel, mockModel2]));
    mockLlmProviderService.getAllConfigs.mockReturnValue(of([]));

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: LlmModelService, useValue: mockLlmModelService },
        { provide: LlmProviderService, useValue: mockLlmProviderService },
        {
          provide: ProviderTypeService,
          useValue: {
            types: signal([
              { providerKey: 'google-ai-studio', displayName: 'Google AI Studio', credentialFields: [], isDevelopmentOnly: false },
              { providerKey: 'mock', displayName: 'Mock Provider', credentialFields: [], isDevelopmentOnly: true },
            ]),
            getProviderTypes: jest.fn().mockReturnValue(of([])),
            getDisplayName: jest.fn((key: string) => key),
          },
        },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Settings,
            Brain,
            Plus,
            AlertCircle,
            AlertTriangle,
            Server,
            Pencil,
            Loader2,
            X,
            Key,
            Lock,
            LockOpen,
            Info,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[3.1-1-UNIT-001] should create', () => {
    // Given — default TestBed setup
    // When
    const fixture = TestBed.createComponent(SettingsComponent);
    // Then
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[3.1-1-UNIT-002] should render settings page with data-testid', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="settings-page"]')).toBeTruthy();
  });

  it('[3.1-1-UNIT-003] should render page title with settings icon', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const title = compiled.querySelector('.page-title h1');
    expect(title?.textContent?.trim()).toBe('Settings');
    const icon = compiled.querySelector('.page-title lucide-icon');
    expect(icon).toBeTruthy();
  });

  it('[3.1-1-UNIT-004] should render tab bar with three tabs', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  it('[3.1-1-UNIT-005] should have LLM Models tab active by default', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const llmTab = compiled.querySelector('[data-testid="tab-llm-models"]');
    expect(llmTab?.classList.contains('active')).toBe(true);
    expect(llmTab?.getAttribute('aria-selected')).toBe('true');
  });

  it('[3.1-1-UNIT-006] should show LLM Models list component in LLM Models tab', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const list = compiled.querySelector('[data-testid="llm-models-list"]');
    expect(list).toBeTruthy();
  });

  it('[3.1-1-UNIT-007] should have System tab disabled', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const systemTab = compiled.querySelector('[data-testid="tab-system"]') as HTMLButtonElement;
    expect(systemTab.disabled).toBe(true);
    expect(systemTab.classList.contains('disabled')).toBe(true);
    expect(systemTab.getAttribute('aria-disabled')).toBe('true');
  });

  it('[3.1-1-UNIT-008] should show Coming soon badge on System tab', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const badge = compiled.querySelector('[data-testid="tab-system"] .coming-soon-badge');
    expect(badge?.textContent?.trim()).toBe('Coming soon');
  });

  it('[3.1-1-UNIT-009] should not change tab when System tab is clicked', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    expect(component.activeTab()).toBe('llm-models');
    // When
    component.setTab('system');
    // Then
    expect(component.activeTab()).toBe('llm-models');
  });

  it('[3.1-1-UNIT-010] should have proper ARIA tab panel attributes', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const tab = compiled.querySelector('#tab-llm-models');
    expect(tab?.getAttribute('aria-controls')).toBe('tabpanel-llm-models');
    const panel = compiled.querySelector('#tabpanel-llm-models');
    expect(panel?.getAttribute('role')).toBe('tabpanel');
    expect(panel?.getAttribute('aria-labelledby')).toBe('tab-llm-models');
  });

  it('[3.1-3-UNIT-027] should open add model dialog when openAddModelDialog called', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // When
    fixture.componentInstance.openAddModelDialog();
    fixture.detectChanges();
    // Then
    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.componentInstance.editingModel()).toBeNull();
  });

  it('[3.1-3-UNIT-028] should open edit model dialog with model when openEditModelDialog called', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // When
    fixture.componentInstance.openEditModelDialog(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.componentInstance.editingModel()).toEqual(mockModel);
  });

  it('[3.1-3-UNIT-029] should close model dialog and refresh list on model saved', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.openAddModelDialog();
    fixture.detectChanges();
    // When
    fixture.componentInstance.onModelSaved();
    fixture.detectChanges();
    // Then
    expect(fixture.componentInstance.modelDialogOpen()).toBe(false);
    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeFalsy();
  });

  // --- Deactivation Dialog ---
  it('[4-H1-UNIT-037] should open deactivate dialog on single model deactivate request', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    // When
    component.onDeactivateRequested({
      modelId: 'model-1',
      allModels: [mockModel, mockModel2],
    });
    // Then
    expect(component.deactivateDialogOpen()).toBe(true);
    expect(component.deactivateDialogInput()).toEqual({
      modelIds: ['model-1'],
      allModels: [mockModel, mockModel2],
      context: 'model',
    });
  });

  it('[4-H1-UNIT-038] should open deactivate dialog on bulk deactivate request', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    // When
    component.onDeactivateBulkRequested({
      providerKey: 'google-ai-studio',
      modelIds: ['model-1'],
      allModels: [mockModel, mockModel2],
    });
    // Then
    expect(component.deactivateDialogOpen()).toBe(true);
    expect(component.deactivateDialogInput()?.context).toBe('provider');
    expect(component.deactivateDialogInput()?.providerName).toBe('google-ai-studio');
  });

  it('[4-H1-UNIT-039] should close deactivate dialog and reset state', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    component.onDeactivateRequested({ modelId: 'model-1', allModels: [mockModel] });
    expect(component.deactivateDialogOpen()).toBe(true);
    // When
    component.closeDeactivateDialog();
    // Then
    expect(component.deactivateDialogOpen()).toBe(false);
    expect(component.deactivateDialogInput()).toBeNull();
  });

  it('[4-H1-UNIT-040] should call deactivateModel on single model confirmed', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    component.onDeactivateRequested({ modelId: 'model-1', allModels: [mockModel] });
    // When
    component.onDeactivateConfirmed({ replacementModelId: 'model-2' });
    await fixture.whenStable();
    // Then
    expect(mockLlmModelService.deactivateModel).toHaveBeenCalledWith('model-1', 'model-2');
  });

  it('[4-H1-UNIT-041] should call deactivateProvider on provider confirmed', async () => {
    // Given
    mockLlmModelService.getAllModels.mockReturnValue(of([mockModel, mockModel2]));
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    // Simulate provider deactivation — set providerConfigId via onProviderDeactivateRequested
    component.onProviderDeactivateRequested({
      configId: 'config-1',
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
    });
    await fixture.whenStable();
    // When
    component.onDeactivateConfirmed({ replacementModelId: 'model-2' });
    await fixture.whenStable();
    // Then
    expect(mockLlmProviderService.deactivateProvider).toHaveBeenCalledWith('config-1', 'model-2');
  });

  it('[4-H1-UNIT-049] should set deactivateError signal on single model deactivation failure', async () => {
    // Given
    mockLlmModelService.deactivateModel.mockReturnValue(throwError(() => new Error('fail')));
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    component.onDeactivateRequested({ modelId: 'model-1', allModels: [mockModel] });
    // When
    component.onDeactivateConfirmed({ replacementModelId: 'model-2' });
    await fixture.whenStable();
    // Then
    expect(component.deactivateError()).toBe('Failed to deactivate model. Please try again.');
    expect(component.deactivateDialogOpen()).toBe(false);
  });

  it('[4-H1-UNIT-050] should set deactivateError signal on provider deactivation failure', async () => {
    // Given
    mockLlmProviderService.deactivateProvider.mockReturnValue(throwError(() => new Error('fail')));
    mockLlmModelService.getAllModels.mockReturnValue(of([mockModel, mockModel2]));
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    component.onProviderDeactivateRequested({
      configId: 'config-1',
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
    });
    await fixture.whenStable();
    // When
    component.onDeactivateConfirmed({ replacementModelId: 'model-2' });
    await fixture.whenStable();
    // Then
    expect(component.deactivateError()).toBe('Failed to deactivate provider. Please try again.');
    expect(component.deactivateDialogOpen()).toBe(false);
  });

  it('[4-H1-UNIT-054] should set deactivateError on provider deactivate request fetch failure', async () => {
    // Given
    mockLlmModelService.getAllModels.mockReturnValue(throwError(() => new Error('fetch fail')));
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    // When
    component.onProviderDeactivateRequested({
      configId: 'config-1',
      providerKey: 'google-ai-studio',
      displayName: 'Google AI Studio',
    });
    await fixture.whenStable();
    // Then
    expect(component.deactivateError()).toBe('Failed to load models for provider deactivation. Please try again.');
    expect(component.deactivateDialogOpen()).toBe(false);
  });

  it('[4-H1-UNIT-051] should clear deactivateError when starting new deactivation', async () => {
    // Given — set an existing error
    const fixture = TestBed.createComponent(SettingsComponent);
    const component = fixture.componentInstance;
    component.deactivateError.set('Previous error');
    // When — start new deactivation
    component.onDeactivateRequested({ modelId: 'model-1', allModels: [mockModel] });
    mockLlmModelService.deactivateModel.mockReturnValue(of({ versionsReassigned: 0, deactivatedModelId: 'model-1', replacementModelId: 'model-2' }));
    component.onDeactivateConfirmed({ replacementModelId: 'model-2' });
    await fixture.whenStable();
    // Then
    expect(component.deactivateError()).toBeNull();
  });
});
