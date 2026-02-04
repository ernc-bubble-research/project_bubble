import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { FileText, Plus, Search, X, Tag, ChevronDown, GitBranch, MoreVertical, Copy } from 'lucide-angular';
import { TemplateListComponent } from './template-list.component';
import type { WorkflowTemplateResponseDto } from '@project-bubble/shared';

describe('[P0] TemplateListComponent', () => {
  let component: TemplateListComponent;
  let fixture: ComponentFixture<TemplateListComponent>;
  let httpMock: HttpTestingController;

  const mockTemplates: WorkflowTemplateResponseDto[] = [
    {
      id: 'template-1',
      tenantId: 'tenant-1',
      name: 'Analyze Transcript',
      description: 'Analyze interview transcripts',
      visibility: 'public',
      allowedTenants: null,
      status: 'published',
      currentVersionId: 'v1',
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      currentVersion: {
        id: 'v1',
        tenantId: 'tenant-1',
        templateId: 'template-1',
        versionNumber: 1,
        definition: { metadata: { name: 'Test', tags: ['analysis'] } },
        createdBy: 'user-1',
        createdAt: new Date(),
      },
    },
    {
      id: 'template-2',
      tenantId: 'tenant-1',
      name: 'Draft Workflow',
      description: 'A draft workflow',
      visibility: 'private',
      allowedTenants: ['tenant-1'],
      status: 'draft',
      currentVersionId: null,
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const mockRouter = {
    navigate: jest.fn().mockReturnValue(Promise.resolve(true)),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [TemplateListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ FileText, Plus, Search, X, Tag, ChevronDown, GitBranch, MoreVertical, Copy }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateListComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    jest.clearAllMocks();
  });

  afterEach(() => {
    httpMock.verify();
    jest.useRealTimers();
  });

  describe('fetch and display', () => {
    it('[3.7-UNIT-014] [P0] Given component initializes, when templates are fetched, then displays templates in grid', () => {
      // Given/When
      fixture.detectChanges();

      // Respond to HTTP request
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // Then
      expect(component.templates()).toHaveLength(2);
      expect(component.isLoading()).toBe(false);
      const cards = fixture.nativeElement.querySelectorAll('app-template-card');
      expect(cards.length).toBe(2);
    });

    it('[3.7-UNIT-014a] [P1] Given no templates, when rendered, then shows empty state', () => {
      // Given/When
      fixture.detectChanges();

      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush([]);
      fixture.detectChanges();

      // Then
      const emptyState = fixture.nativeElement.querySelector('[data-testid="template-list-empty"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No workflows yet');
    });
  });

  describe('filtering', () => {
    it('[3.7-UNIT-015] [P0] Given templates loaded, when filter is applied, then shows only matching templates', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // When - filter by published status
      component.onFiltersChange({
        status: 'published',
        visibility: 'all',
        tags: [],
        search: '',
      });
      fixture.detectChanges();

      // Then
      expect(component.filteredTemplates()).toHaveLength(1);
      expect(component.filteredTemplates()[0].status).toBe('published');
    });

    it('[3.7-UNIT-015a] [P1] Given templates loaded, when search is applied, then filters by name', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // When - search for 'Analyze'
      component.updateSearch('Analyze');
      fixture.detectChanges();

      // Then
      expect(component.filteredTemplates()).toHaveLength(1);
      expect(component.filteredTemplates()[0].name).toContain('Analyze');
    });

    it('[3.7-UNIT-015b] [P1] Given templates loaded, when visibility filter is applied, then shows only matching visibility', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // When - filter by private visibility
      component.onFiltersChange({
        status: 'all',
        visibility: 'private',
        tags: [],
        search: '',
      });
      fixture.detectChanges();

      // Then
      expect(component.filteredTemplates()).toHaveLength(1);
      expect(component.filteredTemplates()[0].visibility).toBe('private');
    });
  });

  describe('navigation', () => {
    it('[3.7-UNIT-016] [P0] Given template card, when clicked, then navigates to edit page', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // When
      component.onTemplateClick(mockTemplates[0]);

      // Then
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/workflows/edit', 'template-1']);
    });

    it('[3.7-UNIT-017] [P0] Given create button, when clicked, then navigates to create page', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // When
      component.navigateToCreate();

      // Then
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/workflows/create']);
    });

    it('[3.7-UNIT-017a] [P1] Given component, when rendered, then create button has correct testid', () => {
      // Given/When
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // Then
      const createButton = fixture.nativeElement.querySelector('[data-testid="create-workflow-button"]');
      expect(createButton).toBeTruthy();
    });
  });

  describe('status counts', () => {
    it('[3.7-UNIT-014b] [P1] Given templates loaded, when computed, then shows correct status counts', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-templates');
      req.flush(mockTemplates);
      fixture.detectChanges();

      // Then
      const counts = component.statusCounts();
      expect(counts.all).toBe(2);
      expect(counts.published).toBe(1);
      expect(counts.draft).toBe(1);
      expect(counts.archived).toBe(0);
    });
  });
});
