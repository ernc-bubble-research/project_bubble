import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { FormsModule } from '@angular/forms';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  AlertTriangle,
  AlertCircle,
  X,
} from 'lucide-angular';
import { ModelDeactivateDialogComponent, type DeactivateDialogInput } from './model-deactivate-dialog.component';
import { LlmModelService, type LlmModel } from '../../core/services/llm-model.service';

const mockModels: LlmModel[] = [
  {
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
  },
  {
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
  },
  {
    id: 'model-3',
    providerKey: 'mock',
    modelId: 'mock-model',
    displayName: 'Mock Model',
    contextWindow: 4096,
    maxOutputTokens: 1024,
    isActive: false,
    costPer1kInput: null,
    costPer1kOutput: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const defaultInput: DeactivateDialogInput = {
  modelIds: ['model-1'],
  allModels: mockModels,
  context: 'model',
};

describe('ModelDeactivateDialogComponent [P1]', () => {
  let mockLlmModelService: {
    getAffectedWorkflows: jest.Mock;
  };

  function createComponent(input: DeactivateDialogInput = defaultInput): ComponentFixture<ModelDeactivateDialogComponent> {
    const fixture = TestBed.createComponent(ModelDeactivateDialogComponent);
    fixture.componentRef.setInput('dialogInput', input);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(async () => {
    mockLlmModelService = {
      getAffectedWorkflows: jest.fn().mockReturnValue(of([])),
    };

    await TestBed.configureTestingModule({
      imports: [ModelDeactivateDialogComponent, FormsModule],
      providers: [
        { provide: LlmModelService, useValue: mockLlmModelService },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            AlertTriangle,
            AlertCircle,
            X,
          }),
        },
      ],
    }).compileComponents();
  });

  it('[4-H1-UNIT-013] should create the component', async () => {
    const fixture = createComponent();
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('[4-H1-UNIT-014] should load affected workflows on init', async () => {
    const affectedWorkflows = [
      { versionId: 'v1', templateId: 't1', templateName: 'Template A', versionNumber: 1, templateStatus: 'published' },
    ];
    mockLlmModelService.getAffectedWorkflows.mockReturnValue(of(affectedWorkflows));

    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(mockLlmModelService.getAffectedWorkflows).toHaveBeenCalledWith('model-1');
    expect(fixture.componentInstance.affectedWorkflows()).toEqual(affectedWorkflows);
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('[4-H1-UNIT-015] should show affected workflows list', async () => {
    mockLlmModelService.getAffectedWorkflows.mockReturnValue(of([
      { versionId: 'v1', templateId: 't1', templateName: 'Template A', versionNumber: 1, templateStatus: 'published' },
    ]));

    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="affected-workflows-list"]')).toBeTruthy();
    expect(el.textContent).toContain('Template A');
    expect(el.textContent).toContain('v1');
  });

  it('[4-H1-UNIT-016] should show no-affected message when no workflows affected', async () => {
    mockLlmModelService.getAffectedWorkflows.mockReturnValue(of([]));

    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="no-affected-workflows"]')).toBeTruthy();
    expect(el.textContent).toContain('No workflow versions reference this model');
  });

  it('[4-H1-UNIT-017] should filter replacement models (exclude deactivating + inactive)', async () => {
    const fixture = createComponent();
    await fixture.whenStable();

    const replacements = fixture.componentInstance.replacementModels();
    // model-1 is being deactivated (excluded), model-3 is inactive (excluded)
    // Only model-2 (active, not deactivating) should be in the list
    expect(replacements).toHaveLength(1);
    expect(replacements[0].id).toBe('model-2');
  });

  it('[4-H1-UNIT-018] should show no-replacements banner when no active models remain', async () => {
    const input: DeactivateDialogInput = {
      modelIds: ['model-1', 'model-2'],
      allModels: mockModels,
      context: 'provider',
      providerName: 'Test Provider',
    };

    const fixture = createComponent(input);
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="no-replacements-banner"]')).toBeTruthy();
    expect(el.textContent).toContain('Cannot deactivate');
  });

  it('[4-H1-UNIT-019] should disable confirm button when no replacement selected', async () => {
    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.canConfirm()).toBe(false);
    const btn = fixture.nativeElement.querySelector('[data-testid="deactivate-confirm-btn"]') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('[4-H1-UNIT-020] should enable confirm button when replacement selected', async () => {
    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    fixture.componentInstance.onReplacementChange('model-2');
    fixture.detectChanges();

    expect(fixture.componentInstance.canConfirm()).toBe(true);
  });

  it('[4-H1-UNIT-021] should emit confirmed with replacementModelId on confirm', async () => {
    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const spy = jest.fn();
    fixture.componentInstance.confirmed.subscribe(spy);
    fixture.componentInstance.onReplacementChange('model-2');
    fixture.componentInstance.onConfirm();

    expect(spy).toHaveBeenCalledWith({ replacementModelId: 'model-2' });
  });

  it('[4-H1-UNIT-022] should emit cancelled on cancel', async () => {
    const fixture = createComponent();
    await fixture.whenStable();

    const spy = jest.fn();
    fixture.componentInstance.cancelled.subscribe(spy);
    fixture.componentInstance.onCancel();

    expect(spy).toHaveBeenCalled();
  });

  it('[4-H1-UNIT-023] should show error state on load failure', async () => {
    mockLlmModelService.getAffectedWorkflows.mockReturnValue(
      throwError(() => new Error('API Error')),
    );

    const fixture = createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="deactivate-error"]')).toBeTruthy();
    expect(el.textContent).toContain('Failed to load affected workflows');
  });

  it('[4-H1-UNIT-024] should show provider title for provider context', async () => {
    const input: DeactivateDialogInput = {
      modelIds: ['model-1'],
      allModels: mockModels,
      context: 'provider',
      providerName: 'Google AI Studio',
    };

    const fixture = createComponent(input);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.dialogTitle()).toContain('Google AI Studio');
  });

  it('[4-H1-UNIT-025] should show model title for model context', async () => {
    const fixture = createComponent();
    await fixture.whenStable();

    expect(fixture.componentInstance.dialogTitle()).toBe('Deactivate Model');
  });

  it('[4-H1-UNIT-026] should return correct status badge classes', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    expect(component.getStatusBadgeClass('published')).toBe('badge-published');
    expect(component.getStatusBadgeClass('draft')).toBe('badge-draft');
    expect(component.getStatusBadgeClass('archived')).toBe('badge-archived');
    expect(component.getStatusBadgeClass('unknown')).toBe('badge-default');
  });
});
