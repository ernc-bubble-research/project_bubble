import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { ChevronUp, ChevronDown, Trash2, ArrowDown, Layers } from 'lucide-angular';
import { ChainStepsListComponent } from './chain-steps-list.component';
import type { ChainStep } from '@project-bubble/shared';

describe('ChainStepsListComponent', () => {
  let component: ChainStepsListComponent;
  let fixture: ComponentFixture<ChainStepsListComponent>;

  const mockSteps: ChainStep[] = [
    { workflow_id: 'wf-1', alias: 'step_0' },
    { workflow_id: 'wf-2', alias: 'step_1' },
    { workflow_id: 'wf-3', alias: 'step_2' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainStepsListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ ChevronUp, ChevronDown, Trash2, ArrowDown, Layers }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainStepsListComponent);
    component = fixture.componentInstance;
  });

  it('[3.6b-UNIT-011] [P0] Given steps array, when rendered, then displays steps in correct order', () => {
    // Given
    fixture.componentRef.setInput('steps', mockSteps);

    // When
    fixture.detectChanges();

    // Then
    const stepCards = fixture.nativeElement.querySelectorAll('.step-card');
    expect(stepCards.length).toBe(3);
    expect(stepCards[0].getAttribute('data-testid')).toBe('chain-step-0');
    expect(stepCards[1].getAttribute('data-testid')).toBe('chain-step-1');
    expect(stepCards[2].getAttribute('data-testid')).toBe('chain-step-2');
  });

  it('[3.6b-UNIT-012] [P0] Given exactly 2 steps, when rendered, then remove buttons are disabled', () => {
    // Given
    const twoSteps: ChainStep[] = [
      { workflow_id: 'wf-1', alias: 'step_0' },
      { workflow_id: 'wf-2', alias: 'step_1' },
    ];
    fixture.componentRef.setInput('steps', twoSteps);

    // When
    fixture.detectChanges();

    // Then
    const removeButtons = fixture.nativeElement.querySelectorAll('[data-testid^="chain-step-remove-"]');
    expect(removeButtons.length).toBe(2);
    expect(removeButtons[0].disabled).toBe(true);
    expect(removeButtons[1].disabled).toBe(true);
  });

  it('[3.6b-UNIT-012b] [P1] Given more than 2 steps, when rendered, then remove buttons are enabled', () => {
    // Given
    fixture.componentRef.setInput('steps', mockSteps);

    // When
    fixture.detectChanges();

    // Then
    const removeButtons = fixture.nativeElement.querySelectorAll('[data-testid^="chain-step-remove-"]');
    expect(removeButtons.length).toBe(3);
    expect(removeButtons[0].disabled).toBe(false);
  });

  it('[3.6b-UNIT-013] [P0] Given steps, when moveUp is called, then step moves up in order', () => {
    // Given
    fixture.componentRef.setInput('steps', mockSteps);
    fixture.detectChanges();

    const emitSpy = jest.spyOn(component.stepsChange, 'emit');

    // When
    component.moveUp(1);

    // Then
    expect(emitSpy).toHaveBeenCalledWith([
      { workflow_id: 'wf-2', alias: 'step_1' },
      { workflow_id: 'wf-1', alias: 'step_0' },
      { workflow_id: 'wf-3', alias: 'step_2' },
    ]);
  });

  it('[3.6b-UNIT-013b] [P1] Given steps, when moveDown is called, then step moves down in order', () => {
    // Given
    fixture.componentRef.setInput('steps', mockSteps);
    fixture.detectChanges();

    const emitSpy = jest.spyOn(component.stepsChange, 'emit');

    // When
    component.moveDown(0);

    // Then
    expect(emitSpy).toHaveBeenCalledWith([
      { workflow_id: 'wf-2', alias: 'step_1' },
      { workflow_id: 'wf-1', alias: 'step_0' },
      { workflow_id: 'wf-3', alias: 'step_2' },
    ]);
  });
});
