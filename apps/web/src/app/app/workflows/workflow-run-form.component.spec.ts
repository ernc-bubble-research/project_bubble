import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Zap,
  Loader2,
  AlertCircle,
  ArrowLeft,
  CircleCheck,
  UploadCloud,
} from 'lucide-angular';
import { WorkflowRunFormComponent } from './workflow-run-form.component';
import { WorkflowCatalogService } from '../../core/services/workflow-catalog.service';
import { AssetService } from '../../core/services/asset.service';

const templateId = 'tmpl-aaaa-1111';

const mockTemplate = {
  id: templateId,
  tenantId: 'tenant-1',
  name: 'Analyze Transcript',
  description: 'Analyze interview transcripts',
  visibility: 'public',
  allowedTenants: null,
  status: 'published',
  currentVersionId: 'ver-1',
  creditsPerRun: 2,
  createdBy: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  currentVersion: {
    id: 'ver-1',
    versionNumber: 1,
    definition: {
      metadata: { name: 'Analyze Transcript', description: 'Test', version: 1 },
      inputs: [
        {
          name: 'context_doc',
          label: 'Context Document',
          role: 'context',
          source: ['asset', 'text'],
          required: true,
          description: 'Upload or paste your context document',
        },
        {
          name: 'notes',
          label: 'Additional Notes',
          role: 'context',
          source: ['text'],
          required: false,
        },
      ],
      execution: { processing: 'parallel', model: 'mock-model' },
      knowledge: { enabled: false },
      prompt: 'Analyze: {{context_doc}}',
      output: { format: 'markdown', filename_template: 'output' },
    },
  },
};

const mockAssets = [
  { id: 'asset-1', originalName: 'file1.pdf' },
  { id: 'asset-2', originalName: 'file2.docx' },
];

describe('WorkflowRunFormComponent [P1]', () => {
  let mockCatalogService: { getById: jest.Mock; submitRun: jest.Mock };
  let mockAssetService: { findAll: jest.Mock; upload: jest.Mock };
  let mockRouter: { navigate: jest.Mock };

  function setup(paramMap = { get: () => templateId }, templateReturn = of(mockTemplate)) {
    mockCatalogService = {
      getById: jest.fn().mockReturnValue(templateReturn),
      submitRun: jest.fn(),
    };
    mockAssetService = {
      findAll: jest.fn().mockReturnValue(of(mockAssets)),
      upload: jest.fn(),
    };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      imports: [WorkflowRunFormComponent],
      providers: [
        { provide: WorkflowCatalogService, useValue: mockCatalogService },
        { provide: AssetService, useValue: mockAssetService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap } },
        },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Zap,
            Loader2,
            AlertCircle,
            ArrowLeft,
            CircleCheck,
            UploadCloud,
          }),
        },
      ],
    });

    return TestBed.createComponent(WorkflowRunFormComponent);
  }

  it('[4.1-UNIT-028] [P0] should load template and render input fields', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="input-group-context_doc"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="input-group-notes"]')).toBeTruthy();
    expect(el.textContent).toContain('Context Document');
    expect(el.textContent).toContain('Additional Notes');
  });

  it('[4.1-UNIT-029] [P0] should show loading state while template loads', () => {
    const subject = new Subject();
    const fixture = setup(undefined, subject.asObservable() as any);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="run-form-loading"]')).toBeTruthy();
    expect(fixture.componentInstance.loading()).toBe(true);

    subject.complete();
  });

  it('[4.1-UNIT-030] [P0] should show error when template fails to load', async () => {
    const fixture = setup(undefined, throwError(() => new Error('Not found')));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="run-form-error"]')).toBeTruthy();
    expect(el.textContent).toContain('Workflow template not found');
  });

  it('[4.1-UNIT-031] [P0] should show error when no templateId in route', async () => {
    const fixture = setup({ get: () => null });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="run-form-error"]')).toBeTruthy();
    expect(el.textContent).toContain('No template ID provided');
  });

  it('[4.1-UNIT-032] [P0] should show source toggle for inputs with mixed sources', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    // context_doc has ['asset', 'text'] — mixed — should show toggle
    expect(el.querySelector('[data-testid="source-toggle-context_doc"]')).toBeTruthy();
    // notes has ['text'] only — not mixed — no toggle
    expect(el.querySelector('[data-testid="source-toggle-notes"]')).toBeFalsy();
  });

  it('[4.1-UNIT-033] [P0] should disable submit button when required inputs are empty', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = el.querySelector('[data-testid="submit-run"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);
  });

  it('[4.1-UNIT-034] [P0] should navigate back when back button clicked', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const backBtn = el.querySelector('[data-testid="back-to-catalog"]') as HTMLButtonElement;
    backBtn.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app/workflows']);
  });

  it('[4.1-UNIT-035] [P0] should display credits info', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('2');
    expect(el.textContent).toContain('credits per run');
  });

  it('[4.1-UNIT-036] [P1] hasMixedSources returns true for mixed, false for single', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.hasMixedSources({
      name: 'test', label: 'T', role: 'context', source: ['asset', 'text'], required: true,
    })).toBe(true);
    expect(component.hasMixedSources({
      name: 'test', label: 'T', role: 'context', source: ['text'], required: true,
    })).toBe(false);
  });

  it('[4.1-UNIT-037] [P1] mapSourceToMode maps text to text, others to asset', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    expect(component.mapSourceToMode('text')).toBe('text');
    expect(component.mapSourceToMode('asset')).toBe('asset');
    expect(component.mapSourceToMode('upload')).toBe('asset');
  });

  describe('getAcceptString', () => {
    it('[4-FIX-A2-UNIT-017] [P0] Given extensions with leading dots, when getAcceptString called, then no double dots', () => {
      const fixture = setup();
      const component = fixture.componentInstance;

      const input = {
        name: 'doc', label: 'Doc', role: 'context' as const,
        source: ['asset' as const], required: true,
        accept: { extensions: ['.pdf', '.docx', '.txt'] },
      };
      expect(component.getAcceptString(input)).toBe('.pdf,.docx,.txt');
    });

    it('[4-FIX-A2-UNIT-018] [P1] Given extensions without leading dots, when getAcceptString called, then dots are added', () => {
      const fixture = setup();
      const component = fixture.componentInstance;

      const input = {
        name: 'doc', label: 'Doc', role: 'context' as const,
        source: ['asset' as const], required: true,
        accept: { extensions: ['pdf', 'docx'] },
      };
      expect(component.getAcceptString(input)).toBe('.pdf,.docx');
    });

    it('[4-FIX-A2-UNIT-019] [P1] Given no accept config, when getAcceptString called, then returns empty string', () => {
      const fixture = setup();
      const component = fixture.componentInstance;

      const input = {
        name: 'doc', label: 'Doc', role: 'context' as const,
        source: ['asset' as const], required: true,
      };
      expect(component.getAcceptString(input)).toBe('');
    });
  });
});
