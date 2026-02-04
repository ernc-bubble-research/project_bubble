import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import {
  ArrowLeft, Save, RefreshCw, AlertCircle, Link, Plus, Trash2,
  ChevronUp, ChevronDown, ArrowDown, Layers, HelpCircle, Info, LogIn, LogOut, ArrowRightLeft, X,
} from 'lucide-angular';
import { ChainBuilderComponent } from './chain-builder.component';

describe('ChainBuilderComponent', () => {
  let component: ChainBuilderComponent;
  let fixture: ComponentFixture<ChainBuilderComponent>;

  function createComponent(routeParams: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [ChainBuilderComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => routeParams[key] || null,
              },
            },
          },
        },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({
            ArrowLeft, Save, RefreshCw, AlertCircle, Link, Plus, Trash2,
            ChevronUp, ChevronDown, ArrowDown, Layers, HelpCircle, Info, LogIn, LogOut, ArrowRightLeft, X,
          }),
        },
      ],
    });

    fixture = TestBed.createComponent(ChainBuilderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('create mode', () => {
    it('[3.6b-UNIT-005] [P0] Given no route param, when component initializes, then starts in create mode with empty state', () => {
      // Given / When
      createComponent();

      // Then
      expect(component.editMode()).toBe(false);
      expect(component.chainId()).toBeNull();
      expect(component.chainState().metadata?.name).toBe('');
      expect(component.chainState().steps?.length).toBe(0);
    });

    it('[3.6b-UNIT-007] [P0] Given invalid chain state, when save is called, then validation errors are set', () => {
      // Given - empty state (invalid - needs 2+ steps)
      createComponent();

      // When
      component.save();

      // Then - validation should fail
      expect(component.validationErrors().length).toBeGreaterThan(0);
    });
  });

  describe('edit mode', () => {
    it('[3.6b-UNIT-006] [P0] Given route param with id, when component initializes, then sets edit mode', () => {
      // Given / When
      createComponent({ id: 'chain-123' });

      // Then
      expect(component.editMode()).toBe(true);
      expect(component.chainId()).toBe('chain-123');
    });
  });

  describe('dirty tracking', () => {
    it('[3.6b-UNIT-008] [P0] Given clean state, when metadata is updated, then isDirty becomes true', () => {
      // Given
      createComponent();
      expect(component.isDirty()).toBe(false);

      // When
      component.updateMetadata({ name: 'Updated', description: 'Updated desc' });

      // Then
      expect(component.isDirty()).toBe(true);
    });

    it('[3.6b-UNIT-008b] [P1] Given clean state, when steps are updated, then isDirty becomes true', () => {
      // Given
      createComponent();
      expect(component.isDirty()).toBe(false);

      // When
      component.updateSteps([{ workflow_id: 'wf-1', alias: 'step_0' }]);

      // Then
      expect(component.isDirty()).toBe(true);
    });

    it('[3.6b-UNIT-008c] [P1] Given clean state, when visibility is updated, then isDirty becomes true', () => {
      // Given
      createComponent();
      expect(component.isDirty()).toBe(false);

      // When
      component.updateVisibility('private');

      // Then
      expect(component.isDirty()).toBe(true);
    });
  });

  describe('addStep', () => {
    it('[3.6b-UNIT-008d] [P1] Given existing steps, when addStep is called, then step is appended', () => {
      // Given
      createComponent();
      component.updateSteps([{ workflow_id: 'wf-1', alias: 'step_0' }]);

      // When
      component.addStep({ workflow_id: 'wf-2', alias: 'step_1' });

      // Then
      expect(component.chainState().steps?.length).toBe(2);
      expect(component.chainState().steps?.[1].alias).toBe('step_1');
    });
  });
});
