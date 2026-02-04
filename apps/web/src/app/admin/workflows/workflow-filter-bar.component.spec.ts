import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Tag, ChevronDown, X } from 'lucide-angular';
import { WorkflowFilterBarComponent, WorkflowFilters, StatusCounts } from './workflow-filter-bar.component';

describe('[P0] WorkflowFilterBarComponent', () => {
  let component: WorkflowFilterBarComponent;
  let fixture: ComponentFixture<WorkflowFilterBarComponent>;

  const defaultFilters: WorkflowFilters = {
    status: 'all',
    visibility: 'all',
    tags: [],
    search: '',
  };

  const mockStatusCounts: StatusCounts = {
    all: 10,
    published: 5,
    draft: 3,
    archived: 2,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowFilterBarComponent, FormsModule],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Tag, ChevronDown, X }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowFilterBarComponent);
    component = fixture.componentInstance;
  });

  describe('status filter tabs', () => {
    it('[3.7-UNIT-009] [P0] Given filters, when status tab is clicked, then emits updated filters', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.filtersChange, 'emit');

      // When
      component.updateStatus('published');

      // Then
      expect(emitSpy).toHaveBeenCalledWith({ ...defaultFilters, status: 'published' });
    });

    it('[3.7-UNIT-009a] [P1] Given status tab is active, when rendered, then shows active styling', () => {
      // Given
      const publishedFilters = { ...defaultFilters, status: 'published' as const };
      fixture.componentRef.setInput('filters', publishedFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);

      // When
      fixture.detectChanges();

      // Then
      const publishedTab = fixture.nativeElement.querySelector('[data-testid="filter-status-published"]');
      expect(publishedTab.classList.contains('active')).toBe(true);
    });

    it('[3.7-UNIT-009b] [P1] Given status counts, when rendered, then shows count badges', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);

      // When
      fixture.detectChanges();

      // Then
      const allTab = fixture.nativeElement.querySelector('[data-testid="filter-status-all"]');
      expect(allTab.textContent).toContain('10');
    });
  });

  describe('visibility filter', () => {
    it('[3.7-UNIT-010] [P0] Given filters, when visibility is changed, then emits updated filters', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.filtersChange, 'emit');

      // When
      component.updateVisibility('private');

      // Then
      expect(emitSpy).toHaveBeenCalledWith({ ...defaultFilters, visibility: 'private' });
    });

    it('[3.7-UNIT-010a] [P1] Given visibility dropdown, when rendered, then has correct data-testid', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);

      // When
      fixture.detectChanges();

      // Then
      const visibilitySelect = fixture.nativeElement.querySelector('[data-testid="filter-visibility"]');
      expect(visibilitySelect).toBeTruthy();
    });
  });

  describe('tags filter', () => {
    it('[3.7-UNIT-011] [P0] Given available tags, when tag is toggled, then emits updated filters', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.componentRef.setInput('availableTags', ['analysis', 'interview', 'qualitative']);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.filtersChange, 'emit');

      // When
      component.toggleTag('analysis');

      // Then
      expect(emitSpy).toHaveBeenCalledWith({ ...defaultFilters, tags: ['analysis'] });
    });

    it('[3.7-UNIT-011a] [P1] Given selected tags, when same tag is toggled, then removes it', () => {
      // Given
      const filtersWithTags = { ...defaultFilters, tags: ['analysis', 'interview'] };
      fixture.componentRef.setInput('filters', filtersWithTags);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.componentRef.setInput('availableTags', ['analysis', 'interview', 'qualitative']);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.filtersChange, 'emit');

      // When
      component.toggleTag('analysis');

      // Then
      expect(emitSpy).toHaveBeenCalledWith({ ...filtersWithTags, tags: ['interview'] });
    });

    it('[3.7-UNIT-011b] [P1] Given available tags, when rendered, then shows tags filter', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.componentRef.setInput('availableTags', ['analysis', 'interview']);

      // When
      fixture.detectChanges();

      // Then
      const tagsFilter = fixture.nativeElement.querySelector('[data-testid="filter-tags"]');
      expect(tagsFilter).toBeTruthy();
    });

    it('[3.7-UNIT-011c] [P1] Given no available tags, when rendered, then hides tags filter', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.componentRef.setInput('availableTags', []);

      // When
      fixture.detectChanges();

      // Then
      const tagsFilter = fixture.nativeElement.querySelector('[data-testid="filter-tags"]');
      expect(tagsFilter).toBeFalsy();
    });
  });

  describe('clear filters', () => {
    it('[3.7-UNIT-009c] [P1] Given active filters, when clear is clicked, then resets all filters', () => {
      // Given
      const activeFilters: WorkflowFilters = {
        status: 'published',
        visibility: 'private',
        tags: ['analysis'],
        search: 'test',
      };
      fixture.componentRef.setInput('filters', activeFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.filtersChange, 'emit');

      // When
      component.clearFilters();

      // Then
      expect(emitSpy).toHaveBeenCalledWith({
        status: 'all',
        visibility: 'all',
        tags: [],
        search: '',
      });
    });

    it('[3.7-UNIT-009d] [P1] Given active filters, when rendered, then shows clear button', () => {
      // Given
      const activeFilters: WorkflowFilters = { ...defaultFilters, status: 'published' };
      fixture.componentRef.setInput('filters', activeFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);

      // When
      fixture.detectChanges();

      // Then
      const clearButton = fixture.nativeElement.querySelector('[data-testid="filter-clear"]');
      expect(clearButton).toBeTruthy();
    });

    it('[3.7-UNIT-009e] [P1] Given no active filters, when rendered, then hides clear button', () => {
      // Given
      fixture.componentRef.setInput('filters', defaultFilters);
      fixture.componentRef.setInput('statusCounts', mockStatusCounts);

      // When
      fixture.detectChanges();

      // Then
      const clearButton = fixture.nativeElement.querySelector('[data-testid="filter-clear"]');
      expect(clearButton).toBeFalsy();
    });
  });
});
