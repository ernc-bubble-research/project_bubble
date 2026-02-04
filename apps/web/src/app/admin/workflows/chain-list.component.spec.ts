import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { FileText, Plus, Search, X, Tag, ChevronDown, Link, Layers } from 'lucide-angular';
import { ChainListComponent } from './chain-list.component';
import type { WorkflowChainResponseDto } from '@project-bubble/shared';

describe('[P0] ChainListComponent', () => {
  let component: ChainListComponent;
  let fixture: ComponentFixture<ChainListComponent>;
  let httpMock: HttpTestingController;

  const mockChains: WorkflowChainResponseDto[] = [
    {
      id: 'chain-1',
      tenantId: 'tenant-1',
      name: 'Analysis Pipeline',
      description: 'Process and analyze data',
      visibility: 'public',
      allowedTenants: null,
      status: 'published',
      definition: {
        metadata: { name: 'Analysis Pipeline' },
        steps: [
          { workflow_id: 'wf-1', alias: 'step_0' },
          { workflow_id: 'wf-2', alias: 'step_1' },
        ],
      },
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'chain-2',
      tenantId: 'tenant-1',
      name: 'Draft Chain',
      description: 'A draft chain',
      visibility: 'private',
      allowedTenants: ['tenant-1'],
      status: 'draft',
      definition: {
        metadata: { name: 'Draft Chain' },
        steps: [{ workflow_id: 'wf-3', alias: 'step_0' }],
      },
      createdBy: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  const mockRouter = {
    navigate: jest.fn().mockReturnValue(Promise.resolve(true)),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [ChainListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: mockRouter },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ FileText, Plus, Search, X, Tag, ChevronDown, Link, Layers }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainListComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);

    jest.clearAllMocks();
  });

  afterEach(() => {
    httpMock.verify();
    jest.useRealTimers();
  });

  describe('fetch and display', () => {
    it('[3.7-UNIT-018] [P0] Given component initializes, when chains are fetched, then displays chains in grid', () => {
      // Given/When
      fixture.detectChanges();

      // Respond to HTTP request
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
      fixture.detectChanges();

      // Then
      expect(component.chains()).toHaveLength(2);
      expect(component.isLoading()).toBe(false);
      const cards = fixture.nativeElement.querySelectorAll('app-chain-card');
      expect(cards.length).toBe(2);
    });

    it('[3.7-UNIT-018a] [P1] Given no chains, when rendered, then shows empty state', () => {
      // Given/When
      fixture.detectChanges();

      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush([]);
      fixture.detectChanges();

      // Then
      const emptyState = fixture.nativeElement.querySelector('[data-testid="chain-list-empty"]');
      expect(emptyState).toBeTruthy();
      expect(emptyState.textContent).toContain('No chains yet');
    });
  });

  describe('filtering', () => {
    it('[3.7-UNIT-019] [P0] Given chains loaded, when filter is applied, then shows only matching chains', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
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
      expect(component.filteredChains()).toHaveLength(1);
      expect(component.filteredChains()[0].status).toBe('published');
    });

    it('[3.7-UNIT-019a] [P1] Given chains loaded, when search is applied, then filters by name', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
      fixture.detectChanges();

      // When - search for 'Pipeline'
      component.updateSearch('Pipeline');
      fixture.detectChanges();

      // Then
      expect(component.filteredChains()).toHaveLength(1);
      expect(component.filteredChains()[0].name).toContain('Pipeline');
    });
  });

  describe('navigation', () => {
    it('[3.7-UNIT-020] [P0] Given chain card, when clicked, then navigates to edit page', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
      fixture.detectChanges();

      // When
      component.onChainClick(mockChains[0]);

      // Then
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/workflows/chains', 'chain-1', 'edit']);
    });

    it('[3.7-UNIT-021] [P0] Given create button, when clicked, then navigates to create page', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
      fixture.detectChanges();

      // When
      component.navigateToCreate();

      // Then
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/workflows/chains/new']);
    });

    it('[3.7-UNIT-021a] [P1] Given component, when rendered, then create button has correct testid', () => {
      // Given/When
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
      fixture.detectChanges();

      // Then
      const createButton = fixture.nativeElement.querySelector('[data-testid="create-chain-button"]');
      expect(createButton).toBeTruthy();
    });
  });

  describe('status counts', () => {
    it('[3.7-UNIT-018b] [P1] Given chains loaded, when computed, then shows correct status counts', () => {
      // Given
      fixture.detectChanges();
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush(mockChains);
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
