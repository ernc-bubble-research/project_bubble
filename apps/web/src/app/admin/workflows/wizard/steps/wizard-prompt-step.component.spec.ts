import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { AlertTriangle } from 'lucide-angular';
import { WorkflowDefinition } from '@project-bubble/shared';
import { WizardPromptStepComponent } from './wizard-prompt-step.component';

/**
 * [P1] WizardPromptStepComponent — Bidirectional variable validation tests
 */
describe('[P1] WizardPromptStepComponent', () => {
  let component: WizardPromptStepComponent;
  let fixture: ComponentFixture<WizardPromptStepComponent>;

  const stateWithInputs: Partial<WorkflowDefinition> = {
    inputs: [
      { name: 'transcripts', label: 'Transcripts', role: 'subject', source: ['upload'], required: true },
      { name: 'codebook', label: 'Codebook', role: 'context', source: ['asset'], required: true },
    ],
    prompt: 'Analyze {transcripts} using {codebook}',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardPromptStepComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ AlertTriangle }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WizardPromptStepComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('state', stateWithInputs);
    fixture.detectChanges();
  });

  it('[3.2-UNIT-021] should detect used variables in prompt', () => {
    // Given prompt contains {transcripts} and {codebook}
    // When checking usedVariables
    // Then both should be listed as used
    expect(component.usedVariables()).toContain('transcripts');
    expect(component.usedVariables()).toContain('codebook');
  });

  it('[3.2-UNIT-022] should warn about unknown variables in prompt', () => {
    // Given prompt contains {unknown_var} not matching any input
    component.form.patchValue({ prompt: 'Use {unknown_var} here' });
    fixture.detectChanges();
    // Then unknownVariables should contain 'unknown_var'
    expect(component.unknownVariables()).toContain('unknown_var');
  });

  it('[3.2-UNIT-023] should warn about unreferenced inputs', () => {
    // Given prompt only references {transcripts} but not {codebook}
    component.form.patchValue({ prompt: 'Analyze {transcripts} only' });
    fixture.detectChanges();
    // Then unusedVariables should contain 'codebook'
    expect(component.unusedVariables()).toContain('codebook');
  });

  it('[3.2-UNIT-024] should report no unknown/unused when all variables match', () => {
    // Given prompt references all inputs
    // Then no warnings
    expect(component.unknownVariables().length).toBe(0);
    expect(component.unusedVariables().length).toBe(0);
  });
});
