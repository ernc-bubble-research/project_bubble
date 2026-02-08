import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { GitBranch, MoreVertical, Copy, Settings } from 'lucide-angular';
import { TemplateCardComponent } from './template-card.component';
import type { WorkflowTemplateResponseDto } from '@project-bubble/shared';

describe('[P0] TemplateCardComponent', () => {
  let component: TemplateCardComponent;
  let fixture: ComponentFixture<TemplateCardComponent>;

  const mockTemplate: WorkflowTemplateResponseDto = {
    id: 'template-123',
    tenantId: 'tenant-1',
    name: 'Test Workflow Template',
    description: 'A test workflow for analyzing data',
    visibility: 'public',
    allowedTenants: null,
    status: 'published',
    currentVersionId: 'version-1',
    createdBy: 'user-1',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-04T10:00:00Z'),
    currentVersion: {
      id: 'version-1',
      tenantId: 'tenant-1',
      templateId: 'template-123',
      versionNumber: 3,
      definition: {
        metadata: {
          name: 'Test Workflow',
          tags: ['analysis', 'interview', 'qualitative'],
        },
      },
      createdBy: 'user-1',
      createdAt: new Date('2026-02-01'),
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TemplateCardComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ GitBranch, MoreVertical, Copy, Settings }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplateCardComponent);
    component = fixture.componentInstance;
  });

  describe('display content', () => {
    it('[3.7-UNIT-003] [P0] Given a template, when rendered, then displays template name and description', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const title = fixture.nativeElement.querySelector('.card-title');
      const description = fixture.nativeElement.querySelector('.card-description');
      expect(title.textContent).toContain('Test Workflow Template');
      expect(description.textContent).toContain('A test workflow for analyzing data');
    });

    it('[3.7-UNIT-004] [P0] Given a template with status, when rendered, then shows correct status badge', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const statusBadge = fixture.nativeElement.querySelector('.status-badge');
      expect(statusBadge.textContent.trim()).toBe('PUBLISHED');
      expect(statusBadge.classList.contains('published')).toBe(true);
    });

    it('[3.7-UNIT-004a] [P1] Given a draft template, when rendered, then shows draft badge with correct styling', () => {
      // Given
      const draftTemplate = { ...mockTemplate, status: 'draft' };
      fixture.componentRef.setInput('template', draftTemplate);

      // When
      fixture.detectChanges();

      // Then
      const statusBadge = fixture.nativeElement.querySelector('.status-badge');
      expect(statusBadge.textContent.trim()).toBe('DRAFT');
      expect(statusBadge.classList.contains('draft')).toBe(true);
    });

    it('[3.7-UNIT-005] [P0] Given a template with visibility, when rendered, then shows visibility badge', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const visibilityBadge = fixture.nativeElement.querySelector('.visibility-badge');
      expect(visibilityBadge.textContent.trim()).toBe('PUBLIC');
      expect(visibilityBadge.classList.contains('public')).toBe(true);
    });

    it('[3.7-UNIT-005a] [P1] Given a private template, when rendered, then shows private badge', () => {
      // Given
      const privateTemplate = { ...mockTemplate, visibility: 'private' };
      fixture.componentRef.setInput('template', privateTemplate);

      // When
      fixture.detectChanges();

      // Then
      const visibilityBadge = fixture.nativeElement.querySelector('.visibility-badge');
      expect(visibilityBadge.textContent.trim()).toBe('PRIVATE');
      expect(visibilityBadge.classList.contains('private')).toBe(true);
    });
  });

  describe('click interaction', () => {
    it('[3.7-UNIT-006] [P0] Given a template card, when clicked, then emits click event with template', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.detectChanges();
      const emitSpy = jest.spyOn(component.cardClick, 'emit');

      // When
      const card = fixture.nativeElement.querySelector('.template-card');
      card.click();

      // Then
      expect(emitSpy).toHaveBeenCalledWith(mockTemplate);
    });
  });

  describe('tags display', () => {
    it('[3.7-UNIT-003a] [P1] Given a template with tags, when rendered, then displays up to 3 tags', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const tags = fixture.nativeElement.querySelectorAll('.tag-pill:not(.tag-more)');
      expect(tags.length).toBe(3);
    });

    it('[3.7-UNIT-003b] [P1] Given a template with more than 3 tags, when rendered, then shows +N more', () => {
      // Given - mockTemplate.currentVersion is defined in test data
      const baseVersion = mockTemplate.currentVersion;
      if (!baseVersion) throw new Error('Test setup error: currentVersion is undefined');
      const manyTagsTemplate: WorkflowTemplateResponseDto = {
        ...mockTemplate,
        currentVersion: {
          ...baseVersion,
          definition: {
            metadata: {
              name: 'Test',
              tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'],
            },
          },
        },
      };
      fixture.componentRef.setInput('template', manyTagsTemplate);

      // When
      fixture.detectChanges();

      // Then
      const moreTag = fixture.nativeElement.querySelector('.tag-more');
      expect(moreTag).toBeTruthy();
      expect(moreTag.textContent).toContain('+2 more');
    });
  });

  describe('version and date display', () => {
    it('[3.7-UNIT-003c] [P1] Given a template with version, when rendered, then shows version number', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const versionInfo = fixture.nativeElement.querySelector('.version-info');
      expect(versionInfo.textContent).toContain('v3');
    });

    it('[3.7-UNIT-003d] [P1] Given a template, when rendered, then shows relative modified date', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const modifiedDate = fixture.nativeElement.querySelector('.modified-date');
      expect(modifiedDate.textContent).toBeTruthy();
    });
  });

  describe('data-testid', () => {
    it('[3.7-UNIT-006a] [P1] Given a template, when rendered, then has correct data-testid', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);

      // When
      fixture.detectChanges();

      // Then
      const card = fixture.nativeElement.querySelector('[data-testid="template-card-template-123"]');
      expect(card).toBeTruthy();
    });
  });

  describe('duplicate action', () => {
    it('[3.7-UNIT-022] [P0] Given a template card, when menu button clicked, then shows dropdown', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.detectChanges();

      // When
      const menuBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-menu"]');
      menuBtn.click();
      fixture.detectChanges();

      // Then
      const dropdown = fixture.nativeElement.querySelector('.actions-dropdown');
      expect(dropdown).toBeTruthy();
    });

    it('[3.7-UNIT-023] [P0] Given dropdown open, when duplicate clicked, then emits duplicateClick', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.detectChanges();
      const emitSpy = jest.spyOn(component.duplicateClick, 'emit');

      // Open menu
      const menuBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-menu"]');
      menuBtn.click();
      fixture.detectChanges();

      // When
      const duplicateBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-duplicate"]');
      duplicateBtn.click();

      // Then
      expect(emitSpy).toHaveBeenCalledWith(mockTemplate);
    });

    it('[3.8-UNIT-001] [P0] Given dropdown open, when settings clicked, then emits settingsClick', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.detectChanges();
      const emitSpy = jest.spyOn(component.settingsClick, 'emit');

      // Open menu
      const menuBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-menu"]');
      menuBtn.click();
      fixture.detectChanges();

      // When
      const settingsBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-settings"]');
      settingsBtn.click();

      // Then
      expect(emitSpy).toHaveBeenCalledWith(mockTemplate);
    });

    it('[3.8-UNIT-001a] [P1] Given dropdown open, when settings clicked, then closes menu', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.detectChanges();

      // Open menu
      const menuBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-menu"]');
      menuBtn.click();
      fixture.detectChanges();

      // When
      const settingsBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-settings"]');
      settingsBtn.click();
      fixture.detectChanges();

      // Then
      expect(component.showMenu()).toBe(false);
    });

    it('[3.7-UNIT-023a] [P1] Given dropdown open, when duplicate clicked, then closes menu', () => {
      // Given
      fixture.componentRef.setInput('template', mockTemplate);
      fixture.detectChanges();

      // Open menu
      const menuBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-menu"]');
      menuBtn.click();
      fixture.detectChanges();

      // When
      const duplicateBtn = fixture.nativeElement.querySelector('[data-testid="template-card-template-123-duplicate"]');
      duplicateBtn.click();
      fixture.detectChanges();

      // Then
      expect(component.showMenu()).toBe(false);
    });
  });
});
