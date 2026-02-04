import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Plus, RefreshCw, Info, HelpCircle } from 'lucide-angular';
import { ChainAddStepComponent } from './chain-add-step.component';

describe('ChainAddStepComponent', () => {
  let component: ChainAddStepComponent;
  let fixture: ComponentFixture<ChainAddStepComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainAddStepComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Plus, RefreshCw, Info, HelpCircle }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainAddStepComponent);
    component = fixture.componentInstance;
  });

  it('[3.6b-UNIT-014] [P0] Given component init, when initialized, then isLoading starts as true', () => {
    // Given
    fixture.componentRef.setInput('existingStepCount', 0);

    // Then - isLoading should be true before detectChanges triggers loadPublishedTemplates
    expect(component.isLoading()).toBe(true);
  });

  it('[3.6b-UNIT-015] [P0] Given template selected, when add step is clicked, then emits step with auto-generated alias', () => {
    // Given
    fixture.componentRef.setInput('existingStepCount', 2);
    fixture.detectChanges();

    // Manually set templates (simulating loaded state)
    component.publishedTemplates.set([
      {
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'Template 1',
        description: 'First template',
        visibility: 'public',
        allowedTenants: null,
        currentVersion: null,
        createdBy: 'user-1',
        createdAt: '2026-02-04',
        updatedAt: '2026-02-04',
      },
    ]);
    component.isLoading.set(false);

    const emitSpy = jest.spyOn(component.stepAdded, 'emit');

    // Select a template
    component.selectedTemplateId = 'wf-1';

    // When
    component.addStep();

    // Then
    expect(emitSpy).toHaveBeenCalledWith({
      workflow_id: 'wf-1',
      alias: 'step_2',
    });
  });

  it('[3.6b-UNIT-015b] [P1] Given no template selected, when add step is clicked, then does not emit', () => {
    // Given
    fixture.componentRef.setInput('existingStepCount', 0);
    fixture.detectChanges();

    const emitSpy = jest.spyOn(component.stepAdded, 'emit');

    // When - no template selected
    component.addStep();

    // Then
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('[3.6b-UNIT-015c] [P1] Given template selected, when add step is clicked, then clears selection', () => {
    // Given
    fixture.componentRef.setInput('existingStepCount', 0);
    fixture.detectChanges();

    component.publishedTemplates.set([
      {
        id: 'wf-1',
        tenantId: 'tenant-1',
        name: 'Template 1',
        description: 'First template',
        visibility: 'public',
        allowedTenants: null,
        currentVersion: null,
        createdBy: 'user-1',
        createdAt: '2026-02-04',
        updatedAt: '2026-02-04',
      },
    ]);

    component.selectedTemplateId = 'wf-1';

    // When
    component.addStep();

    // Then - selection should be cleared
    expect(component.selectedTemplateId).toBe('');
  });
});
