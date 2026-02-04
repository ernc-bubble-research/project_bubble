import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { Info, HelpCircle } from 'lucide-angular';
import { ChainMetadataSectionComponent } from './chain-metadata-section.component';

describe('ChainMetadataSectionComponent', () => {
  let component: ChainMetadataSectionComponent;
  let fixture: ComponentFixture<ChainMetadataSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainMetadataSectionComponent],
      providers: [
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Info, HelpCircle }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainMetadataSectionComponent);
    component = fixture.componentInstance;
  });

  it('[3.6b-UNIT-009] [P0] Given empty name, when isValid is called, then returns false', () => {
    // Given
    fixture.componentRef.setInput('metadata', { name: '', description: '' });
    fixture.detectChanges();

    // When
    const isValid = component.isValid();

    // Then
    expect(isValid).toBe(false);
    expect(component.form.get('name')?.hasError('required')).toBe(true);
  });

  it('[3.6b-UNIT-009b] [P1] Given valid name, when isValid is called, then returns true', () => {
    // Given
    fixture.componentRef.setInput('metadata', { name: 'Test Chain', description: 'Test' });
    fixture.detectChanges();

    // When
    const isValid = component.isValid();

    // Then
    expect(isValid).toBe(true);
  });

  it('[3.6b-UNIT-010] [P0] Given form changes, when user types, then emits metadataChange event', () => {
    // Given
    fixture.componentRef.setInput('metadata', { name: '', description: '' });
    fixture.detectChanges();

    const emitSpy = jest.spyOn(component.metadataChange, 'emit');

    // When
    component.form.patchValue({ name: 'New Name', description: 'New Description' });

    // Then
    expect(emitSpy).toHaveBeenCalledWith({
      name: 'New Name',
      description: 'New Description',
    });
  });
});
