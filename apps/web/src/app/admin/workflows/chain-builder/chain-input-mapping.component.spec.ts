import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Info, HelpCircle } from 'lucide-angular';
import { ChainInputMappingComponent } from './chain-input-mapping.component';
import type { ChainStep } from '@project-bubble/shared';

describe('ChainInputMappingComponent', () => {
  let component: ChainInputMappingComponent;
  let fixture: ComponentFixture<ChainInputMappingComponent>;

  const mockSteps: ChainStep[] = [
    { workflow_id: 'wf-1', alias: 'step_0' },
    { workflow_id: 'wf-2', alias: 'step_1' },
    { workflow_id: 'wf-3', alias: 'step_2' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainInputMappingComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Info, HelpCircle }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainInputMappingComponent);
    component = fixture.componentInstance;
  });

  it('[3.6b-UNIT-016] [P0] Given steps array, when rendered, then shows mapping only for non-first steps', () => {
    // Given
    fixture.componentRef.setInput('steps', mockSteps);

    // When
    fixture.detectChanges();

    // Then - mappableSteps excludes first step
    expect(component.mappableSteps().length).toBe(2);
    expect(component.mappableSteps()[0].alias).toBe('step_1');
    expect(component.mappableSteps()[1].alias).toBe('step_2');
  });

  it('[3.6b-UNIT-016b] [P1] Given single step, when rendered, then shows no mapping cards', () => {
    // Given
    fixture.componentRef.setInput('steps', [{ workflow_id: 'wf-1', alias: 'step_0' }]);

    // When
    fixture.detectChanges();

    // Then
    expect(component.mappableSteps().length).toBe(0);
  });

  it('[3.6b-UNIT-017] [P0] Given step with input mapping, when getInputSource is called, then returns correct source type', () => {
    // Given
    const stepsWithMapping: ChainStep[] = [
      { workflow_id: 'wf-1', alias: 'step_0' },
      {
        workflow_id: 'wf-2',
        alias: 'step_1',
        input_mapping: {
          transcript: { from_step: 'step_0', from_output: 'outputs' },
          format: { from_chain_config: true, value: 'summary' },
        },
      },
    ];
    fixture.componentRef.setInput('steps', stepsWithMapping);
    fixture.detectChanges();

    // When / Then
    expect(component.getInputSource(stepsWithMapping[1], 'transcript')).toBe('from_step');
    expect(component.getInputSource(stepsWithMapping[1], 'format')).toBe('from_chain_config');
    expect(component.getInputSource(stepsWithMapping[1], 'unknown')).toBe('');
  });

  it('[3.6b-UNIT-017b] [P1] Given step, when updateInputSource is called, then emits updated steps', () => {
    // Given
    fixture.componentRef.setInput('steps', mockSteps);
    fixture.detectChanges();

    const emitSpy = jest.spyOn(component.stepsChange, 'emit');

    // When
    const mockEvent = { target: { value: 'from_step' } } as unknown as Event;
    component.updateInputSource('step_1', 'input1', mockEvent);

    // Then
    expect(emitSpy).toHaveBeenCalled();
    const emittedSteps = (emitSpy.mock.calls[0] as [ChainStep[]])[0];
    expect(emittedSteps[1].input_mapping?.['input1']?.from_step).toBe('');
    expect(emittedSteps[1].input_mapping?.['input1']?.from_output).toBe('outputs');
  });
});
