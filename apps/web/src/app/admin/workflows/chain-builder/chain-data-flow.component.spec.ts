import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { LogIn, LogOut, ArrowDown, Layers, ArrowRightLeft } from 'lucide-angular';
import { ChainDataFlowComponent } from './chain-data-flow.component';
import type { ChainStep } from '@project-bubble/shared';

describe('ChainDataFlowComponent', () => {
  let component: ChainDataFlowComponent;
  let fixture: ComponentFixture<ChainDataFlowComponent>;

  const mockSteps: ChainStep[] = [
    { workflow_id: 'wf-1', alias: 'step_0' },
    { workflow_id: 'wf-2', alias: 'step_1' },
    { workflow_id: 'wf-3', alias: 'step_2' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainDataFlowComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ LogIn, LogOut, ArrowDown, Layers, ArrowRightLeft }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainDataFlowComponent);
    component = fixture.componentInstance;
  });

  describe('rendering', () => {
    it('[3.6b-UNIT-023] [P0] Given steps array, when rendered, then displays data-flow-diagram with testid', () => {
      // Given
      fixture.componentRef.setInput('steps', mockSteps);

      // When
      fixture.detectChanges();

      // Then
      const diagram = fixture.nativeElement.querySelector('[data-testid="chain-data-flow-diagram"]');
      expect(diagram).toBeTruthy();
    });

    it('[3.6b-UNIT-023b] [P1] Given steps array, when rendered, then displays correct number of step nodes', () => {
      // Given
      fixture.componentRef.setInput('steps', mockSteps);

      // When
      fixture.detectChanges();

      // Then
      const stepNodes = fixture.nativeElement.querySelectorAll('.step-node');
      expect(stepNodes.length).toBe(3);
    });

    it('[3.6b-UNIT-024] [P0] Given first step, when rendered, then shows "User Input" badge', () => {
      // Given
      fixture.componentRef.setInput('steps', mockSteps);

      // When
      fixture.detectChanges();

      // Then
      const inputBadge = fixture.nativeElement.querySelector('.input-badge');
      expect(inputBadge).toBeTruthy();
      expect(inputBadge.textContent).toContain('User Input');
    });

    it('[3.6b-UNIT-024b] [P1] Given last step, when rendered, then shows "Chain Output" indicator', () => {
      // Given
      fixture.componentRef.setInput('steps', mockSteps);

      // When
      fixture.detectChanges();

      // Then
      const outputIndicator = fixture.nativeElement.querySelector('.output-indicator');
      expect(outputIndicator).toBeTruthy();
      expect(outputIndicator.textContent).toContain('Chain Output');
    });
  });

  describe('connection count', () => {
    it('[3.6b-UNIT-025] [P0] Given steps with no mappings, when connectionCount is computed, then returns 0', () => {
      // Given
      fixture.componentRef.setInput('steps', mockSteps);

      // When
      fixture.detectChanges();

      // Then
      expect(component.connectionCount()).toBe(0);
    });

    it('[3.6b-UNIT-025b] [P1] Given steps with from_step mappings, when connectionCount is computed, then returns correct count', () => {
      // Given
      const stepsWithMappings: ChainStep[] = [
        { workflow_id: 'wf-1', alias: 'step_0' },
        {
          workflow_id: 'wf-2',
          alias: 'step_1',
          input_mapping: {
            input1: { from_step: 'step_0', from_output: 'outputs' },
            input2: { from_step: 'step_0', from_output: 'outputs' },
          },
        },
        {
          workflow_id: 'wf-3',
          alias: 'step_2',
          input_mapping: {
            input3: { from_step: 'step_1', from_output: 'outputs' },
          },
        },
      ];
      fixture.componentRef.setInput('steps', stepsWithMappings);

      // When
      fixture.detectChanges();

      // Then
      expect(component.connectionCount()).toBe(3);
    });

    it('[3.6b-UNIT-025c] [P1] Given steps with mixed mapping types, when connectionCount is computed, then only counts from_step mappings', () => {
      // Given
      const stepsWithMixedMappings: ChainStep[] = [
        { workflow_id: 'wf-1', alias: 'step_0' },
        {
          workflow_id: 'wf-2',
          alias: 'step_1',
          input_mapping: {
            input1: { from_step: 'step_0', from_output: 'outputs' },
            input2: { from_input: 'chain_input' },
            input3: { from_chain_config: true, value: 'fixed' },
          },
        },
      ];
      fixture.componentRef.setInput('steps', stepsWithMixedMappings);

      // When
      fixture.detectChanges();

      // Then
      expect(component.connectionCount()).toBe(1); // Only from_step counts
    });
  });

  describe('mapping labels', () => {
    it('[3.6b-UNIT-026] [P0] Given step with single from_step mapping, when getMappingLabel is called, then returns formatted label', () => {
      // Given
      const stepsWithMapping: ChainStep[] = [
        { workflow_id: 'wf-1', alias: 'step_0' },
        {
          workflow_id: 'wf-2',
          alias: 'step_1',
          input_mapping: {
            transcript: { from_step: 'step_0', from_output: 'outputs' },
          },
        },
      ];
      fixture.componentRef.setInput('steps', stepsWithMapping);
      fixture.detectChanges();

      // When
      const label = component.getMappingLabel(1);

      // Then
      expect(label).toBe('step_0 → transcript');
    });

    it('[3.6b-UNIT-026b] [P1] Given step with multiple from_step mappings, when getMappingLabel is called, then returns count', () => {
      // Given
      const stepsWithMappings: ChainStep[] = [
        { workflow_id: 'wf-1', alias: 'step_0' },
        {
          workflow_id: 'wf-2',
          alias: 'step_1',
          input_mapping: {
            input1: { from_step: 'step_0', from_output: 'outputs' },
            input2: { from_step: 'step_0', from_output: 'outputs' },
            input3: { from_step: 'step_0', from_output: 'outputs' },
          },
        },
      ];
      fixture.componentRef.setInput('steps', stepsWithMappings);
      fixture.detectChanges();

      // When
      const label = component.getMappingLabel(1);

      // Then
      expect(label).toBe('3 mappings');
    });

    it('[3.6b-UNIT-026c] [P1] Given step with no from_step mappings, when getMappingLabel is called, then returns empty string', () => {
      // Given
      const stepsWithNoFromStep: ChainStep[] = [
        { workflow_id: 'wf-1', alias: 'step_0' },
        {
          workflow_id: 'wf-2',
          alias: 'step_1',
          input_mapping: {
            input1: { from_input: 'chain_input' },
          },
        },
      ];
      fixture.componentRef.setInput('steps', stepsWithNoFromStep);
      fixture.detectChanges();

      // When
      const label = component.getMappingLabel(1);

      // Then
      expect(label).toBe('');
    });
  });

  describe('flow summary', () => {
    it('[3.6b-UNIT-027] [P0] Given 2+ steps, when rendered, then shows flow summary with step count', () => {
      // Given
      fixture.componentRef.setInput('steps', mockSteps);

      // When
      fixture.detectChanges();

      // Then
      const summary = fixture.nativeElement.querySelector('.flow-summary');
      expect(summary).toBeTruthy();
      expect(summary.textContent).toContain('3 workflow steps');
    });
  });
});
