import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LucideIconProvider, LUCIDE_ICONS } from 'lucide-angular';
import { RefreshCw, X, Info, HelpCircle } from 'lucide-angular';
import { ChainVisibilitySettingsComponent } from './chain-visibility-settings.component';

describe('ChainVisibilitySettingsComponent', () => {
  let component: ChainVisibilitySettingsComponent;
  let fixture: ComponentFixture<ChainVisibilitySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChainVisibilitySettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ RefreshCw, X, Info, HelpCircle }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChainVisibilitySettingsComponent);
    component = fixture.componentInstance;
  });

  describe('visibility toggle', () => {
    it('[3.6b-UNIT-018] [P0] Given public visibility, when rendered, then public radio is checked', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'public');
      fixture.componentRef.setInput('allowedTenants', []);

      // When
      fixture.detectChanges();

      // Then
      const publicRadio = fixture.nativeElement.querySelector('[data-testid="chain-visibility-public"]') as HTMLInputElement;
      expect(publicRadio.checked).toBe(true);
    });

    it('[3.6b-UNIT-018b] [P1] Given private visibility, when rendered, then private radio is checked', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'private');
      fixture.componentRef.setInput('allowedTenants', []);

      // When
      fixture.detectChanges();

      // Then
      const privateRadio = fixture.nativeElement.querySelector('[data-testid="chain-visibility-private"]') as HTMLInputElement;
      expect(privateRadio.checked).toBe(true);
    });

    it('[3.6b-UNIT-019] [P0] Given public visibility, when changed to private, then emits visibilityChange', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'public');
      fixture.componentRef.setInput('allowedTenants', []);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.visibilityChange, 'emit');

      // When
      component.onVisibilityChange('private');

      // Then
      expect(emitSpy).toHaveBeenCalledWith('private');
    });

    it('[3.6b-UNIT-019b] [P1] Given private visibility, when changed to public, then emits visibilityChange and clears tenants', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'private');
      fixture.componentRef.setInput('allowedTenants', ['tenant-1']);
      fixture.detectChanges();

      const visibilitySpy = jest.spyOn(component.visibilityChange, 'emit');
      const tenantsSpy = jest.spyOn(component.allowedTenantsChange, 'emit');

      // When
      component.onVisibilityChange('public');

      // Then
      expect(visibilitySpy).toHaveBeenCalledWith('public');
      expect(tenantsSpy).toHaveBeenCalledWith([]);
    });
  });

  describe('tenant picker', () => {
    it('[3.6b-UNIT-020] [P0] Given private visibility and tenants loaded, when rendered, then tenant picker is visible', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'private');
      fixture.componentRef.setInput('allowedTenants', []);
      fixture.detectChanges();

      // Simulate tenants loaded (bypasses loading state)
      component.isLoadingTenants.set(false);

      // When
      fixture.detectChanges();

      // Then
      const tenantPicker = fixture.nativeElement.querySelector('[data-testid="chain-allowed-tenants-picker"]');
      expect(tenantPicker).toBeTruthy();
    });

    it('[3.6b-UNIT-020b] [P1] Given public visibility, when rendered, then tenant picker is hidden', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'public');
      fixture.componentRef.setInput('allowedTenants', []);

      // When
      fixture.detectChanges();

      // Then
      const tenantPicker = fixture.nativeElement.querySelector('[data-testid="chain-allowed-tenants-picker"]');
      expect(tenantPicker).toBeFalsy();
    });

    it('[3.6b-UNIT-021] [P0] Given tenant selected, when removeTenant is called, then emits updated tenant list', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'private');
      fixture.componentRef.setInput('allowedTenants', ['tenant-1', 'tenant-2']);
      fixture.detectChanges();

      const emitSpy = jest.spyOn(component.allowedTenantsChange, 'emit');

      // When
      component.removeTenant('tenant-1');

      // Then
      expect(emitSpy).toHaveBeenCalledWith(['tenant-2']);
    });
  });

  describe('validation', () => {
    it('[3.6b-UNIT-022] [P0] Given private visibility with no tenants, when rendered, then shows validation error', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'private');
      fixture.componentRef.setInput('allowedTenants', []);

      // When
      fixture.detectChanges();

      // Then
      const errorMessage = fixture.nativeElement.querySelector('.field-error');
      expect(errorMessage).toBeTruthy();
      expect(errorMessage.textContent).toContain('At least one tenant must be selected');
    });

    it('[3.6b-UNIT-022b] [P1] Given private visibility with tenants, when rendered, then no validation error', () => {
      // Given
      fixture.componentRef.setInput('visibility', 'private');
      fixture.componentRef.setInput('allowedTenants', ['tenant-1']);

      // When
      fixture.detectChanges();

      // Then
      const errorMessage = fixture.nativeElement.querySelector('.field-error');
      expect(errorMessage).toBeFalsy();
    });
  });
});
