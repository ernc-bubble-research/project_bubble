import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { FileText, Link, Plus, Search, X, Tag, ChevronDown, GitBranch, MoreVertical, Copy, Layers } from 'lucide-angular';
import { WorkflowStudioComponent } from './workflow-studio.component';

describe('[P0] WorkflowStudioComponent', () => {
  let component: WorkflowStudioComponent;
  let fixture: ComponentFixture<WorkflowStudioComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowStudioComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ FileText, Link, Plus, Search, X, Tag, ChevronDown, GitBranch, MoreVertical, Copy, Layers }),
        },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);

    fixture = TestBed.createComponent(WorkflowStudioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    // Flush the templates request made by TemplateListComponent
    const req = httpMock.expectOne('/api/admin/workflow-templates');
    req.flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('container structure', () => {
    it('[3.7-UNIT-001] [P0] Given component renders, when page loads, then templates tab is active by default', () => {
      // Given/When - component renders via beforeEach

      // Then
      expect(component.activeTab()).toBe('templates');
      const templatesTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-templates-tab"]');
      expect(templatesTab.classList.contains('active')).toBe(true);
    });

    it('[3.7-UNIT-002] [P0] Given templates tab is active, when chains tab is clicked, then chains tab becomes active', () => {
      // Given
      expect(component.activeTab()).toBe('templates');

      // When
      component.setActiveTab('chains');
      fixture.detectChanges();

      // Flush the chains request made by ChainListComponent
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush([]);
      fixture.detectChanges();

      // Then
      expect(component.activeTab()).toBe('chains');
      const chainsTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-chains-tab"]');
      expect(chainsTab.classList.contains('active')).toBe(true);
      const templatesTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-templates-tab"]');
      expect(templatesTab.classList.contains('active')).toBe(false);
    });
  });

  describe('data-testid attributes', () => {
    it('[3.7-UNIT-001a] [P1] Given component renders, when checking testids, then container has correct testid', () => {
      // Given/When - component renders

      // Then
      const container = fixture.nativeElement.querySelector('[data-testid="workflow-studio-container"]');
      expect(container).toBeTruthy();
    });

    it('[3.7-UNIT-001b] [P1] Given component renders, when checking testids, then tabs have correct testids', () => {
      // Given/When - component renders

      // Then
      const templatesTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-templates-tab"]');
      const chainsTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-chains-tab"]');
      expect(templatesTab).toBeTruthy();
      expect(chainsTab).toBeTruthy();
    });
  });

  describe('tab content', () => {
    it('[3.7-UNIT-002a] [P1] Given templates tab is active, when rendered, then templates content is visible', () => {
      // Given
      component.setActiveTab('templates');
      fixture.detectChanges();

      // When/Then
      const templatesContent = fixture.nativeElement.querySelector('[data-testid="templates-content"]');
      const chainsContent = fixture.nativeElement.querySelector('[data-testid="chains-content"]');
      expect(templatesContent).toBeTruthy();
      expect(chainsContent).toBeFalsy();
    });

    it('[3.7-UNIT-002b] [P1] Given chains tab is active, when rendered, then chains content is visible', () => {
      // Given
      component.setActiveTab('chains');
      fixture.detectChanges();

      // Flush the chains request made by ChainListComponent
      const req = httpMock.expectOne('/api/admin/workflow-chains');
      req.flush([]);
      fixture.detectChanges();

      // When/Then
      const templatesContent = fixture.nativeElement.querySelector('[data-testid="templates-content"]');
      const chainsContent = fixture.nativeElement.querySelector('[data-testid="chains-content"]');
      expect(templatesContent).toBeFalsy();
      expect(chainsContent).toBeTruthy();
    });
  });
});
