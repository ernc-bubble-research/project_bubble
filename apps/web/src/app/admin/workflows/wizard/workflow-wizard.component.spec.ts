import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  Check, ArrowLeft, Save, ChevronRight, AlertCircle, AlertTriangle,
  RefreshCw, FileText, Layers, Zap, Brain, MessageSquare, FileOutput,
  Info, Plus, Trash2, ChevronDown, ChevronUp,
} from 'lucide-angular';
import { WorkflowWizardComponent } from './workflow-wizard.component';

/**
 * [P0] WorkflowWizardComponent — Stepper and navigation tests
 */
describe('[P0] WorkflowWizardComponent', () => {
  let component: WorkflowWizardComponent;
  let fixture: ComponentFixture<WorkflowWizardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowWizardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Check, ArrowLeft, Save, ChevronRight, AlertCircle, AlertTriangle,
            RefreshCw, FileText, Layers, Zap, Brain, MessageSquare, FileOutput,
            Info, Plus, Trash2, ChevronDown, ChevronUp,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowWizardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('[3.2-UNIT-001] should create the wizard component', () => {
    expect(component).toBeTruthy();
  });

  it('[3.2-UNIT-002] should start on step 0 (Metadata)', () => {
    expect(component.currentStep()).toBe(0);
  });

  it('[3.2-UNIT-003] should navigate forward when nextStep is called and step is valid', () => {
    // Given we are on step 0, fill in required metadata fields
    component.updateState({
      metadata: { name: 'Test', description: 'Test desc', version: 1, tags: [] },
    });
    fixture.detectChanges();
    // When we call nextStep (validates the current step)
    component.nextStep();
    // Then current step should be 1
    expect(component.currentStep()).toBe(1);
  });

  it('[3.2-UNIT-004] should NOT navigate forward when step is invalid', () => {
    // Given we are on step 0 with empty required fields
    // When we call nextStep
    component.nextStep();
    // Then current step should remain 0
    expect(component.currentStep()).toBe(0);
    expect(component.stepValidationError()).toBeTruthy();
  });

  it('[3.2-UNIT-005] should navigate backward without validation', () => {
    // Given we fill metadata and navigate to step 1
    component.updateState({
      metadata: { name: 'Test', description: 'Test desc', version: 1, tags: [] },
    });
    fixture.detectChanges();
    component.nextStep();
    expect(component.currentStep()).toBe(1);
    // When we go back
    component.prevStep();
    // Then we should be on step 0
    expect(component.currentStep()).toBe(0);
  });

  it('[3.2-UNIT-006] should allow jumping to a completed step', () => {
    // Given we advanced through steps by setting highestVisitedStep directly
    component.highestVisitedStep.set(3);
    component.currentStep.set(3);
    // When we click on step 1
    component.goToStep(1);
    // Then we should be on step 1
    expect(component.currentStep()).toBe(1);
  });

  it('[3.2-UNIT-007] should NOT allow jumping to an unvisited future step', () => {
    // Given we are on step 0 (never visited step 3)
    // When we try to jump to step 3
    component.goToStep(3);
    // Then we should remain on step 0
    expect(component.currentStep()).toBe(0);
  });

  it('[3.2-UNIT-008] should track highest visited step', () => {
    // Given we advance to step 2 using direct signal manipulation (avoiding form validation)
    component.highestVisitedStep.set(2);
    component.currentStep.set(2);
    // When we go back to step 0
    component.prevStep();
    component.prevStep();
    // Then highestVisitedStep should still be 2
    expect(component.highestVisitedStep()).toBe(2);
  });

  it('[3.2-UNIT-009] should set isDirty when updateState is called', () => {
    // Given wizard starts clean
    expect(component.isDirty()).toBe(false);
    // When we update state
    component.updateState({ prompt: 'test prompt' });
    // Then isDirty should be true
    expect(component.isDirty()).toBe(true);
  });

  it('[3.2-UNIT-010] should populate validation errors on save with invalid definition', () => {
    // Given the wizard state is empty/incomplete
    // When we try to save
    component.save();
    // Then validation errors should be populated
    expect(component.validationErrors().length).toBeGreaterThan(0);
  });

  it('[3.2-UNIT-011] should navigate to first error step on validation failure', () => {
    // Given we are on step 5 (set directly to avoid validation)
    component.highestVisitedStep.set(5);
    component.currentStep.set(5);
    expect(component.currentStep()).toBe(5);
    // When save triggers validation with metadata errors
    component.save();
    // Then it should navigate back to step 0 (metadata errors)
    expect(component.currentStep()).toBe(0);
  });
});
