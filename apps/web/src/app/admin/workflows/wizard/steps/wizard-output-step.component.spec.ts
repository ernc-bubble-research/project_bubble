import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  Plus, Trash2, ChevronDown, ChevronUp, Info,
} from 'lucide-angular';
import { WorkflowDefinition } from '@project-bubble/shared';
import { WizardOutputStepComponent } from './wizard-output-step.component';

/**
 * [P1] WizardOutputStepComponent — Output format and preview tests
 */
describe('[P1] WizardOutputStepComponent', () => {
  let component: WizardOutputStepComponent;
  let fixture: ComponentFixture<WizardOutputStepComponent>;

  const defaultState: Partial<WorkflowDefinition> = {
    metadata: { name: 'Test', description: 'Test desc', version: 1, tags: ['test'] },
    inputs: [
      { name: 'transcripts', label: 'Transcripts', role: 'subject', source: ['upload'], required: true },
    ],
    execution: { processing: 'parallel', model: 'gemini-pro' },
    knowledge: { enabled: false },
    prompt: 'Analyze {transcripts}',
    output: {
      format: 'markdown',
      filename_template: '{subject_name}_output',
      sections: [],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WizardOutputStepComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            Plus, Trash2, ChevronDown, ChevronUp, Info,
          }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WizardOutputStepComponent);
    component = fixture.componentInstance;

    fixture.componentRef.setInput('state', defaultState);
    fixture.detectChanges();
  });

  it('[3.2-UNIT-025] should default to markdown format', () => {
    // Given the default state has markdown format
    // Then isMarkdown should be true (now a computed signal)
    expect(component.isMarkdown).toBe(true);
    expect(component.isJson).toBe(false);
  });

  it('[3.2-UNIT-026] should toggle to json format', () => {
    // Given we switch to json
    component.form.patchValue({ format: 'json' });
    // Then isJson should be true (computed signal)
    expect(component.isJson).toBe(true);
    expect(component.isMarkdown).toBe(false);
  });

  it('[3.2-UNIT-027] should add and remove markdown sections', () => {
    // Given no sections (sectionsArray is now a computed signal)
    expect(component.sectionsArray.length).toBe(0);
    // When we add a section
    component.addSection();
    expect(component.sectionsArray.length).toBe(1);
    // When we remove it
    component.removeSection(0);
    expect(component.sectionsArray.length).toBe(0);
  });

  it('[3.2-UNIT-028] should validate JSON on blur', () => {
    // Given json format with invalid JSON
    component.form.patchValue({ format: 'json', json_schema: 'not json' });
    // When we validate
    component.validateJson();
    // Then error should be set
    expect(component.jsonError()).toBeTruthy();
  });

  it('[3.2-UNIT-029] should clear JSON error for valid JSON', () => {
    // Given json format with valid JSON
    component.form.patchValue({ format: 'json', json_schema: '{"type": "object"}' });
    // When we validate
    component.validateJson();
    // Then no error
    expect(component.jsonError()).toBeNull();
  });

  it('[3.2-UNIT-030] should require filename_template', () => {
    // Given filename_template is empty
    component.form.patchValue({ filename_template: '' });
    component.form.get('filename_template')?.markAsTouched();
    // Then it should be invalid
    expect(component.form.get('filename_template')?.hasError('required')).toBe(true);
  });

  it('[3.2-UNIT-031] should toggle preview panel open/close', () => {
    // Given preview is closed
    expect(component.previewOpen()).toBe(false);
    // When we toggle
    component.togglePreview();
    expect(component.previewOpen()).toBe(true);
    // When we toggle again
    component.togglePreview();
    expect(component.previewOpen()).toBe(false);
  });

  it('[3.2-UNIT-032] should render preview data from wizard state', () => {
    // Given the state has metadata
    // When we access previewData (now a computed signal)
    const preview = component.previewData();
    // Then it should reflect the state
    expect(preview['name']).toBe('Test');
    expect(preview['inputCount']).toBe('1');
    expect(preview['processing']).toBe('parallel');
    expect(preview['knowledgeEnabled']).toBe('No');
  });
});
