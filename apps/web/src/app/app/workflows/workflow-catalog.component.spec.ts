import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError, Subject } from 'rxjs';
import {
  LUCIDE_ICONS,
  LucideIconProvider,
  Zap,
  Loader2,
  AlertCircle,
} from 'lucide-angular';
import { WorkflowCatalogComponent } from './workflow-catalog.component';
import { WorkflowCatalogService } from '../../core/services/workflow-catalog.service';

const mockWorkflows = [
  {
    id: 'aaaa-1111',
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
        metadata: { name: 'Analyze Transcript', description: 'Test', version: 1, tags: ['analysis', 'transcript'] },
      },
    },
  },
  {
    id: 'aaaa-2222',
    tenantId: 'tenant-1',
    name: 'Summarize Doc',
    description: null,
    visibility: 'public',
    allowedTenants: null,
    status: 'published',
    currentVersionId: null,
    creditsPerRun: 1,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe('WorkflowCatalogComponent [P1]', () => {
  let mockCatalogService: { listPublished: jest.Mock };
  let mockRouter: { navigate: jest.Mock };

  function setup(serviceReturn = of(mockWorkflows)) {
    mockCatalogService = { listPublished: jest.fn().mockReturnValue(serviceReturn) };
    mockRouter = { navigate: jest.fn() };

    TestBed.configureTestingModule({
      imports: [WorkflowCatalogComponent],
      providers: [
        { provide: WorkflowCatalogService, useValue: mockCatalogService },
        { provide: Router, useValue: mockRouter },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Zap, Loader2, AlertCircle }),
        },
      ],
    });

    return TestBed.createComponent(WorkflowCatalogComponent);
  }

  it('[4.1-UNIT-020] [P0] should render workflow cards on load', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="catalog-grid"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="workflow-card-aaaa-1111"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="workflow-card-aaaa-2222"]')).toBeTruthy();
  });

  it('[4.1-UNIT-021] [P0] should show credits badge per card', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const badge = el.querySelector('[data-testid="credits-badge-aaaa-1111"]');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toContain('2');
    expect(badge!.textContent).toContain('credits');
  });

  it('[4.1-UNIT-022] [P0] should show loading state initially', () => {
    const subject = new Subject();
    const fixture = setup(subject.asObservable() as any);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="catalog-loading"]')).toBeTruthy();
    expect(fixture.componentInstance.loading()).toBe(true);

    subject.complete();
  });

  it('[4.1-UNIT-023] [P0] should show empty state when no workflows', async () => {
    const fixture = setup(of([]));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="catalog-empty"]')).toBeTruthy();
    expect(el.textContent).toContain('No workflows available');
  });

  it('[4.1-UNIT-024] [P0] should show error state on API failure', async () => {
    const fixture = setup(throwError(() => new Error('API error')));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="catalog-error"]')).toBeTruthy();
    expect(el.textContent).toContain('Failed to load workflows');
  });

  it('[4.1-UNIT-025] [P0] should navigate to run form when Run button clicked', async () => {
    const fixture = setup();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const runBtn = el.querySelector('[data-testid="run-button-aaaa-1111"]') as HTMLButtonElement;
    expect(runBtn).toBeTruthy();
    runBtn.click();

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/app/workflows/run', 'aaaa-1111']);
  });

  it('[4.1-UNIT-026] [P1] should extract tags from definition metadata', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    const tags = component.getDefinitionTags(mockWorkflows[0] as any);
    expect(tags).toEqual(['analysis', 'transcript']);
  });

  it('[4.1-UNIT-027] [P1] should return empty tags when no definition', () => {
    const fixture = setup();
    const component = fixture.componentInstance;

    const tags = component.getDefinitionTags(mockWorkflows[1] as any);
    expect(tags).toEqual([]);
  });
});
