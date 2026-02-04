import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Link, Layers } from 'lucide-angular';
import { ChainCardComponent } from './chain-card.component';
import type { WorkflowChainResponseDto } from '@project-bubble/shared';

describe('[P0] ChainCardComponent', () => {
  let component: ChainCardComponent;
  let fixture: ComponentFixture<ChainCardComponent>;

  const mockChain: WorkflowChainResponseDto = {
    id: 'chain-123',
    tenantId: 'tenant-1',
    name: 'Full Analysis Pipeline',
    description: 'Analyze transcripts then consolidate findings',
    visibility: 'public',
    allowedTenants: null,
    status: 'published',
    createdBy: 'user-1',
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date('2026-02-04T10:00:00Z'),
    definition: {
      steps: [
        { workflow_id: 'wf-1', alias: 'step_0' },
        { workflow_id: 'wf-2', alias: 'step_1' },
        { workflow_id: 'wf-3', alias: 'step_2' },
      ],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainCardComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Link, Layers }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainCardComponent);
    component = fixture.componentInstance;
  });

  describe('display content', () => {
    it('[3.7-UNIT-007] [P0] Given a chain, when rendered, then displays chain info (name, description, status, visibility)', () => {
      // Given
      fixture.componentRef.setInput('chain', mockChain);

      // When
      fixture.detectChanges();

      // Then
      const title = fixture.nativeElement.querySelector('.card-title');
      const description = fixture.nativeElement.querySelector('.card-description');
      const statusBadge = fixture.nativeElement.querySelector('.status-badge');
      const visibilityBadge = fixture.nativeElement.querySelector('.visibility-badge');

      expect(title.textContent).toContain('Full Analysis Pipeline');
      expect(description.textContent).toContain('Analyze transcripts then consolidate findings');
      expect(statusBadge.textContent.trim()).toBe('PUBLISHED');
      expect(visibilityBadge.textContent.trim()).toBe('PUBLIC');
    });

    it('[3.7-UNIT-008] [P0] Given a chain with steps, when rendered, then shows step count', () => {
      // Given
      fixture.componentRef.setInput('chain', mockChain);

      // When
      fixture.detectChanges();

      // Then
      const stepCount = fixture.nativeElement.querySelector('.step-count');
      expect(stepCount.textContent).toContain('3 steps');
    });

    it('[3.7-UNIT-008a] [P1] Given a chain with 1 step, when rendered, then shows singular "step"', () => {
      // Given
      const singleStepChain: WorkflowChainResponseDto = {
        ...mockChain,
        definition: {
          steps: [{ workflow_id: 'wf-1', alias: 'step_0' }],
        },
      };
      fixture.componentRef.setInput('chain', singleStepChain);

      // When
      fixture.detectChanges();

      // Then
      const stepCount = fixture.nativeElement.querySelector('.step-count');
      expect(stepCount.textContent).toContain('1 step');
      expect(stepCount.textContent).not.toContain('steps');
    });
  });

  describe('click interaction', () => {
    it('[3.7-UNIT-007a] [P1] Given a chain card, when clicked, then emits click event with chain', () => {
      // Given
      fixture.componentRef.setInput('chain', mockChain);
      fixture.detectChanges();
      const emitSpy = jest.spyOn(component.cardClick, 'emit');

      // When
      const card = fixture.nativeElement.querySelector('.chain-card');
      card.click();

      // Then
      expect(emitSpy).toHaveBeenCalledWith(mockChain);
    });
  });

  describe('status badges', () => {
    it('[3.7-UNIT-007b] [P1] Given a draft chain, when rendered, then shows draft badge', () => {
      // Given
      const draftChain = { ...mockChain, status: 'draft' };
      fixture.componentRef.setInput('chain', draftChain);

      // When
      fixture.detectChanges();

      // Then
      const statusBadge = fixture.nativeElement.querySelector('.status-badge');
      expect(statusBadge.textContent.trim()).toBe('DRAFT');
      expect(statusBadge.classList.contains('draft')).toBe(true);
    });

    it('[3.7-UNIT-007c] [P1] Given a private chain, when rendered, then shows private badge', () => {
      // Given
      const privateChain = { ...mockChain, visibility: 'private' };
      fixture.componentRef.setInput('chain', privateChain);

      // When
      fixture.detectChanges();

      // Then
      const visibilityBadge = fixture.nativeElement.querySelector('.visibility-badge');
      expect(visibilityBadge.textContent.trim()).toBe('PRIVATE');
      expect(visibilityBadge.classList.contains('private')).toBe(true);
    });
  });

  describe('data-testid', () => {
    it('[3.7-UNIT-007d] [P1] Given a chain, when rendered, then has correct data-testid', () => {
      // Given
      fixture.componentRef.setInput('chain', mockChain);

      // When
      fixture.detectChanges();

      // Then
      const card = fixture.nativeElement.querySelector('[data-testid="chain-card-chain-123"]');
      expect(card).toBeTruthy();
    });
  });

  describe('modified date', () => {
    it('[3.7-UNIT-007e] [P1] Given a chain, when rendered, then shows relative modified date', () => {
      // Given
      fixture.componentRef.setInput('chain', mockChain);

      // When
      fixture.detectChanges();

      // Then
      const modifiedDate = fixture.nativeElement.querySelector('.modified-date');
      expect(modifiedDate.textContent).toBeTruthy();
    });
  });
});
