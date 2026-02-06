import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Settings,
  Brain,
  Plus,
  AlertCircle,
  Server,
  Pencil,
  Loader2,
  X,
} from 'lucide-angular';
import { SettingsComponent } from './settings.component';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';

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

describe('SettingsComponent [P2]', () => {
  const mockLlmModelService = {
    getAllModels: jest.fn().mockReturnValue(of([mockModel])),
    createModel: jest.fn().mockReturnValue(of(mockModel)),
    updateModel: jest.fn().mockReturnValue(of(mockModel)),
  };

  beforeEach(async () => {
    mockLlmModelService.getAllModels.mockReturnValue(of([mockModel]));

    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        { provide: LlmModelService, useValue: mockLlmModelService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Settings,
            Brain,
            Plus,
            AlertCircle,
            Server,
            Pencil,
            Loader2,
            X,
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

  it('[3.1-1-UNIT-004] should render tab bar with two tabs', () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    // When
    fixture.detectChanges();
    // Then
    const compiled = fixture.nativeElement as HTMLElement;
    const tabs = compiled.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
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

  it('[3.1-3-UNIT-027] should open add dialog when openAddDialog called', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // When
    fixture.componentInstance.openAddDialog();
    fixture.detectChanges();
    // Then
    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.componentInstance.editingModel()).toBeNull();
  });

  it('[3.1-3-UNIT-028] should open edit dialog with model when openEditDialog called', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // When
    fixture.componentInstance.openEditDialog(mockModel);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    // Then
    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeTruthy();
    expect(fixture.componentInstance.editingModel()).toEqual(mockModel);
  });

  it('[3.1-3-UNIT-029] should close dialog and refresh list on model saved', async () => {
    // Given
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    fixture.componentInstance.openAddDialog();
    fixture.detectChanges();
    // When
    fixture.componentInstance.onModelSaved();
    fixture.detectChanges();
    // Then
    expect(fixture.componentInstance.dialogOpen()).toBe(false);
    const dialog = fixture.nativeElement.querySelector('[data-testid="form-dialog"]');
    expect(dialog).toBeFalsy();
  });
});
