import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Search, X } from 'lucide-angular';
import { WorkflowSearchComponent } from './workflow-search.component';

describe('[P0] WorkflowSearchComponent', () => {
  let component: WorkflowSearchComponent;
  let fixture: ComponentFixture<WorkflowSearchComponent>;

  beforeEach(async () => {
    jest.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [WorkflowSearchComponent, FormsModule],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Search, X }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowSearchComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('debounced search', () => {
    it('[3.7-UNIT-012] [P0] Given search input, when typing, then debounces search by configured delay', () => {
      // Given
      fixture.componentRef.setInput('value', '');
      fixture.componentRef.setInput('debounceMs', 300);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.searchChange, 'emit');

      // When - type 'test'
      component.onInput({ target: { value: 'test' } } as unknown as Event);

      // Then - not emitted immediately
      expect(emitSpy).not.toHaveBeenCalled();

      // When - wait for debounce
      jest.advanceTimersByTime(300);

      // Then - emitted after debounce
      expect(emitSpy).toHaveBeenCalledWith('test');
    });

    it('[3.7-UNIT-012a] [P1] Given multiple rapid inputs, when debounced, then emits only final value', () => {
      // Given
      fixture.componentRef.setInput('value', '');
      fixture.componentRef.setInput('debounceMs', 300);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.searchChange, 'emit');

      // When - type rapidly
      component.onInput({ target: { value: 't' } } as unknown as Event);
      jest.advanceTimersByTime(100);
      component.onInput({ target: { value: 'te' } } as unknown as Event);
      jest.advanceTimersByTime(100);
      component.onInput({ target: { value: 'tes' } } as unknown as Event);
      jest.advanceTimersByTime(100);
      component.onInput({ target: { value: 'test' } } as unknown as Event);
      jest.advanceTimersByTime(300);

      // Then - only final value emitted
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith('test');
    });
  });

  describe('clear button', () => {
    it('[3.7-UNIT-013] [P0] Given search has value, when clear is clicked, then clears search and emits empty', () => {
      // Given
      fixture.componentRef.setInput('value', '');
      fixture.componentRef.setInput('debounceMs', 300);
      fixture.detectChanges();

      component.searchValue.set('test');
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.searchChange, 'emit');

      // When
      component.clearSearch();
      jest.advanceTimersByTime(300);

      // Then
      expect(component.searchValue()).toBe('');
      expect(emitSpy).toHaveBeenCalledWith('');
    });

    it('[3.7-UNIT-013a] [P1] Given search has value, when rendered, then shows clear button', () => {
      // Given
      fixture.componentRef.setInput('value', '');
      fixture.detectChanges();
      component.searchValue.set('test');

      // When
      fixture.detectChanges();

      // Then
      const clearButton = fixture.nativeElement.querySelector('[data-testid="workflow-search-clear"]');
      expect(clearButton).toBeTruthy();
    });

    it('[3.7-UNIT-013b] [P1] Given search is empty, when rendered, then hides clear button', () => {
      // Given
      fixture.componentRef.setInput('value', '');

      // When
      fixture.detectChanges();

      // Then
      const clearButton = fixture.nativeElement.querySelector('[data-testid="workflow-search-clear"]');
      expect(clearButton).toBeFalsy();
    });
  });

  describe('data-testid', () => {
    it('[3.7-UNIT-012b] [P1] Given search component, when rendered, then has correct data-testid on input', () => {
      // Given
      fixture.componentRef.setInput('value', '');

      // When
      fixture.detectChanges();

      // Then
      const input = fixture.nativeElement.querySelector('[data-testid="workflow-search-input"]');
      expect(input).toBeTruthy();
    });
  });
});
