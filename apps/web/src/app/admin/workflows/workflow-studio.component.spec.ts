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

    // Only templates tab renders by default (@if), flush its request
    const templateReq = httpMock.expectOne('/api/admin/workflow-templates');
    templateReq.flush([]);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('container structure', () => {
    it('[3.7-UNIT-001] [P0] Given component renders, when page loads, then templates tab is active by default', () => {
      expect(component.activeTab()).toBe('templates');
      const templatesTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-templates-tab"]');
      expect(templatesTab.classList.contains('active')).toBe(true);
    });

    it('[3.7-UNIT-002] [P0] Given templates tab is active, when chains tab is clicked, then chains tab becomes active', () => {
      expect(component.activeTab()).toBe('templates');

      component.setActiveTab('chains');
      fixture.detectChanges();

      // Chains tab now renders and fires HTTP request
      const chainReq = httpMock.expectOne('/api/admin/workflow-chains');
      chainReq.flush([]);

      expect(component.activeTab()).toBe('chains');
      const chainsTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-chains-tab"]');
      expect(chainsTab.classList.contains('active')).toBe(true);
      const templatesTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-templates-tab"]');
      expect(templatesTab.classList.contains('active')).toBe(false);
    });
  });

  describe('data-testid attributes', () => {
    it('[3.7-UNIT-001a] [P1] Given component renders, when checking testids, then container has correct testid', () => {
      const container = fixture.nativeElement.querySelector('[data-testid="workflow-studio-container"]');
      expect(container).toBeTruthy();
    });

    it('[3.7-UNIT-001b] [P1] Given component renders, when checking testids, then tabs have correct testids', () => {
      const templatesTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-templates-tab"]');
      const chainsTab = fixture.nativeElement.querySelector('[data-testid="workflow-studio-chains-tab"]');
      expect(templatesTab).toBeTruthy();
      expect(chainsTab).toBeTruthy();
    });
  });

  describe('tab content', () => {
    it('[3.7-UNIT-002a] [P1] Given templates tab is active, when rendered, then templates content exists and chains content does not', () => {
      component.setActiveTab('templates');
      fixture.detectChanges();

      const templatesContent = fixture.nativeElement.querySelector('[data-testid="templates-content"]');
      const chainsContent = fixture.nativeElement.querySelector('[data-testid="chains-content"]');
      expect(templatesContent).toBeTruthy();
      expect(chainsContent).toBeFalsy();
    });

    it('[3.7-UNIT-002b] [P1] Given chains tab is active, when rendered, then chains content exists and templates content does not', () => {
      component.setActiveTab('chains');
      fixture.detectChanges();

      // Chains tab renders and fires HTTP request
      const chainReq = httpMock.expectOne('/api/admin/workflow-chains');
      chainReq.flush([]);

      const templatesContent = fixture.nativeElement.querySelector('[data-testid="templates-content"]');
      const chainsContent = fixture.nativeElement.querySelector('[data-testid="chains-content"]');
      expect(templatesContent).toBeFalsy();
      expect(chainsContent).toBeTruthy();
    });
  });
});
