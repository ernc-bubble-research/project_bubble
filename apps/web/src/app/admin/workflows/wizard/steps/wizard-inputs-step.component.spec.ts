import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, Info,
} from 'lucide-angular';
import { WorkflowDefinition } from '@project-bubble/shared';
import { WizardInputsStepComponent } from './wizard-inputs-step.component';

/**
 * [P0] WizardInputsStepComponent — Input card CRUD and validation tests
 */
describe('[P0] WizardInputsStepComponent', () => {
  let component: WizardInputsStepComponent;
  let fixture: ComponentFixture<WizardInputsStepComponent>;

  const defaultState: Partial<WorkflowDefinition> = {
    inputs: [],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardInputsStepComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, Info,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WizardInputsStepComponent);
    component = fixture.componentInstance;

    // Set required input using ComponentRef
    fixture.componentRef.setInput('state', defaultState);
    fixture.detectChanges();
  });

  it('[3.2-UNIT-012] should create the inputs step component', () => {
    // Given the component initializes
    // Then it should exist
    expect(component).toBeTruthy();
  });

  it('[3.2-UNIT-013] should add an input card when addInput is called', () => {
    // Given no inputs exist
    expect(component.inputsArray.length).toBe(0);
    // When we add an input
    component.addInput();
    // Then there should be 1 input
    expect(component.inputsArray.length).toBe(1);
  });

  it('[3.2-UNIT-014] should remove an input card when removeInput is called', () => {
    // Given 2 inputs exist
    component.addInput();
    component.addInput();
    expect(component.inputsArray.length).toBe(2);
    // When we remove the first
    component.removeInput(0);
    // Then there should be 1 input
    expect(component.inputsArray.length).toBe(1);
  });

  it('[3.2-UNIT-015] should show subject error when 0 subject inputs', () => {
    // Given no inputs
    // When checking subjectError
    // Then error should indicate 0 subjects
    expect(component.subjectError()).toContain('0');
  });

  it('[3.2-UNIT-016] should show no subject error when exactly 1 subject input', () => {
    // Given we set state with 1 subject input
    fixture.componentRef.setInput('state', {
      inputs: [
        { name: 'transcripts', label: 'Transcripts', role: 'subject', source: ['upload'], required: true },
      ],
    });
    fixture.detectChanges();
    // Then no subject error
    expect(component.subjectError()).toBeNull();
  });

  it('[3.2-UNIT-017] should show subject error when 2+ subject inputs', () => {
    // Given state has 2 subject inputs
    fixture.componentRef.setInput('state', {
      inputs: [
        { name: 'a', label: 'A', role: 'subject', source: ['upload'], required: true },
        { name: 'b', label: 'B', role: 'subject', source: ['upload'], required: true },
      ],
    });
    fixture.detectChanges();
    // Then subject error should mention 2
    expect(component.subjectError()).toContain('2');
  });

  it('[3.2-UNIT-018] should detect duplicate input names', () => {
    // Given state has inputs with the same name
    fixture.componentRef.setInput('state', {
      inputs: [
        { name: 'data', label: 'Data 1', role: 'context', source: ['asset'], required: true },
        { name: 'data', label: 'Data 2', role: 'subject', source: ['upload'], required: true },
      ],
    });
    fixture.detectChanges();
    // Then duplicateNames should have 'data'
    expect(component.duplicateNames()).toContain('data');
  });

  it('[3.2-UNIT-019] should show file restrictions when source includes asset', () => {
    // Given we add an input
    component.addInput();
    // When source_asset is checked
    component.inputsArray.at(0).patchValue({ source_asset: true });
    // Then hasFileSource should be true (reads from form, not DOM)
    expect(component.hasFileSource(0)).toBe(true);
  });

  it('[3.2-UNIT-020] should show text config when source includes text', () => {
    // Given we add an input
    component.addInput();
    // When source_text is checked
    component.inputsArray.at(0).patchValue({ source_text: true });
    // Then hasTextSource should be true (reads from form, not DOM)
    expect(component.hasTextSource(0)).toBe(true);
  });
});
