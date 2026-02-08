import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, Info,
} from 'lucide-angular';
import { WorkflowDefinition, FILE_TYPE_PRESETS } from '@project-bubble/shared';
import { WizardInputsStepComponent } from './wizard-inputs-step.component';

/**
 * [P0] WizardInputsStepComponent — File type preset chip tests (Story 3.10)
 */
describe('[P0] WizardInputsStepComponent Presets', () => {
  let component: WizardInputsStepComponent;
  let fixture: ComponentFixture<WizardInputsStepComponent>;
  let emitted: Partial<WorkflowDefinition> | null;

  const fileInputState: Partial<WorkflowDefinition> = {
    inputs: [
      { name: 'docs', label: 'Documents', role: 'subject', source: ['upload'], required: true },
    ],
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
    emitted = null;

    fixture.componentRef.setInput('state', fileInputState);
    component.stateChange.subscribe((val) => (emitted = val));
    fixture.detectChanges();
  });

  it('[3.10-UNIT-002] should expose presets array with 7 groups', () => {
    // Given the component initializes
    // Then the presets should be available
    expect(component.presets).toHaveLength(7);
  });

  it('[3.10-UNIT-003] should toggle preset ON and add its extensions', () => {
    // Given no presets are active
    expect(component.isPresetActive(0, 'documents')).toBe(false);
    // When we toggle documents ON
    component.togglePreset(0, 'documents');
    // Then documents should be active
    expect(component.isPresetActive(0, 'documents')).toBe(true);
    // And emitted extensions should include document extensions
    const docPreset = FILE_TYPE_PRESETS.find((p) => p.key === 'documents')!;
    expect(emitted?.inputs?.[0].accept?.extensions).toEqual(expect.arrayContaining(docPreset.extensions));
  });

  it('[3.10-UNIT-003a] should toggle preset OFF and remove only its extensions', () => {
    // Given documents and images are active
    component.togglePreset(0, 'documents');
    component.togglePreset(0, 'images');
    // When we toggle documents OFF
    component.togglePreset(0, 'documents');
    // Then documents should be inactive, images still active
    expect(component.isPresetActive(0, 'documents')).toBe(false);
    expect(component.isPresetActive(0, 'images')).toBe(true);
    // And emitted extensions should only have image extensions
    const imgPreset = FILE_TYPE_PRESETS.find((p) => p.key === 'images')!;
    expect(emitted?.inputs?.[0].accept?.extensions).toEqual(imgPreset.extensions);
  });

  it('[3.10-UNIT-004] should clear all other presets when All Files is selected', () => {
    // Given documents preset is active
    component.togglePreset(0, 'documents');
    component.addCustomExtension(0, '.custom');
    expect(component.isPresetActive(0, 'documents')).toBe(true);
    // When we select All Files
    component.togglePreset(0, 'all');
    // Then All Files should be active, documents should not
    expect(component.isPresetActive(0, 'all')).toBe(true);
    expect(component.isPresetActive(0, 'documents')).toBe(false);
    // And custom extensions should be cleared
    expect(component.getCustomExtensions(0)).toEqual([]);
    // And no extensions in output (no restriction)
    expect(emitted?.inputs?.[0].accept).toBeUndefined();
  });

  it('[3.10-UNIT-004a] should deselect All Files when another preset is selected', () => {
    // Given All Files is active
    component.togglePreset(0, 'all');
    expect(component.isPresetActive(0, 'all')).toBe(true);
    // When we select images
    component.togglePreset(0, 'images');
    // Then All Files should be deselected, images should be active
    expect(component.isPresetActive(0, 'all')).toBe(false);
    expect(component.isPresetActive(0, 'images')).toBe(true);
  });

  it('[3.10-UNIT-005] should add a custom extension via addCustomExtension', () => {
    // Given no custom extensions
    expect(component.getCustomExtensions(0)).toEqual([]);
    // When we add a custom extension
    component.addCustomExtension(0, '.custom');
    // Then it should be in the list
    expect(component.getCustomExtensions(0)).toContain('.custom');
    // And it should be in the emitted output
    expect(emitted?.inputs?.[0].accept?.extensions).toContain('.custom');
  });

  it('[3.10-UNIT-005a] should remove a custom extension', () => {
    // Given a custom extension exists
    component.addCustomExtension(0, '.custom');
    expect(component.getCustomExtensions(0)).toContain('.custom');
    // When we remove it
    component.removeCustomExtension(0, '.custom');
    // Then it should be gone
    expect(component.getCustomExtensions(0)).not.toContain('.custom');
  });

  it('[3.10-UNIT-005b] should preserve custom extensions when toggling presets', () => {
    // Given a custom extension and a preset are active
    component.addCustomExtension(0, '.xyz');
    component.togglePreset(0, 'documents');
    // When we toggle documents OFF
    component.togglePreset(0, 'documents');
    // Then custom extension should survive
    expect(component.getCustomExtensions(0)).toContain('.xyz');
    expect(emitted?.inputs?.[0].accept?.extensions).toEqual(['.xyz']);
  });

  it('[3.10-UNIT-006] should reverse-map existing extensions to active presets on init', async () => {
    // Given state has all document extensions + a custom one
    const docPreset = FILE_TYPE_PRESETS.find((p) => p.key === 'documents')!;
    const stateWithExts: Partial<WorkflowDefinition> = {
      inputs: [{
        name: 'files', label: 'Files', role: 'subject', source: ['upload'], required: true,
        accept: { extensions: [...docPreset.extensions, '.custom'] },
      }],
    };

    // Create a fresh component with this state
    const f2 = TestBed.createComponent(WizardInputsStepComponent);
    f2.componentRef.setInput('state', stateWithExts);
    f2.detectChanges();
    const c2 = f2.componentInstance;

    // Then documents preset should be active
    // Note: preset index depends on how many presets were pushed; the new component has its own state.
    // The fresh component's inputPresetState should have documents active at index 0
    expect(c2.isPresetActive(0, 'documents')).toBe(true);
    expect(c2.getCustomExtensions(0)).toEqual(['.custom']);

    f2.destroy();
  });

  it('[3.10-UNIT-007] should build correct extensions array in syncToParent', () => {
    // Given documents preset and a custom extension
    component.togglePreset(0, 'documents');
    component.addCustomExtension(0, '.custom');
    // Then emitted output should have all doc extensions + custom
    const docPreset = FILE_TYPE_PRESETS.find((p) => p.key === 'documents')!;
    expect(emitted?.inputs?.[0].accept?.extensions).toEqual([...docPreset.extensions, '.custom']);
  });

  it('should normalize custom extensions with dot prefix', () => {
    // Given we add an extension without dot
    component.addCustomExtension(0, 'xyz');
    // Then it should be normalized to have a dot
    expect(component.getCustomExtensions(0)).toContain('.xyz');
  });

  it('should not add duplicate custom extensions', () => {
    // Given we add the same extension twice
    component.addCustomExtension(0, '.dup');
    component.addCustomExtension(0, '.dup');
    // Then it should only appear once
    expect(component.getCustomExtensions(0).filter((e) => e === '.dup')).toHaveLength(1);
  });

  it('[3.10-UNIT-008] should strip trailing commas from custom extension input', () => {
    // Given the comma keydown handler passes value with trailing comma
    component.addCustomExtension(0, '.csv,');
    // Then the comma should be stripped during normalization
    expect(component.getCustomExtensions(0)).toContain('.csv');
    expect(component.getCustomExtensions(0)).not.toContain('.csv,');
  });

  it('should remove preset state when removing an input', () => {
    // Given two inputs with presets
    component.addInput();
    component.togglePreset(0, 'documents');
    component.togglePreset(1, 'images');
    // When we remove the first input
    component.removeInput(0);
    // Then the remaining input should have images preset (shifted from index 1 to 0)
    expect(component.isPresetActive(0, 'images')).toBe(true);
    expect(component.isPresetActive(0, 'documents')).toBe(false);
  });
});
