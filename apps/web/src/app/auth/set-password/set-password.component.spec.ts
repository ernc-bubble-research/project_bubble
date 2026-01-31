import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LUCIDE_ICONS, LucideIconProvider, Eye, EyeOff } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { SetPasswordComponent } from './set-password.component';
import { AuthService } from '../../core/services/auth.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

describe('SetPasswordComponent', () => {
  let fixture: ComponentFixture<SetPasswordComponent>;
  let component: SetPasswordComponent;
  let authServiceMock: Record<string, jest.Mock>;
  let router: Router;

  beforeEach(async () => {
    authServiceMock = {
      setPassword: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [SetPasswordComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'token' ? 'valid-token-123' : null),
              },
            },
          },
        },
        {
          provide: LUCIDE_ICONS,
          multi: true,
          useValue: new LucideIconProvider({ Eye, EyeOff }),
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetPasswordComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should read token from query params', () => {
    expect(component.token).toBe('valid-token-123');
  });

  it('should render password form with two password fields', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input#newPassword')).toBeTruthy();
    expect(el.querySelector('input#confirmPassword')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('should require password fields', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(component.passwordForm.get('newPassword')?.hasError('required')).toBe(true);
    expect(component.passwordForm.get('confirmPassword')?.hasError('required')).toBe(true);
  });

  it('should enforce minimum length of 8 characters', () => {
    component.passwordForm.get('newPassword')?.setValue('Short1');
    component.passwordForm.get('newPassword')?.markAsTouched();
    fixture.detectChanges();

    expect(component.passwordForm.get('newPassword')?.hasError('minlength')).toBe(true);
  });

  it('should enforce password complexity (uppercase + lowercase + number)', () => {
    component.passwordForm.get('newPassword')?.setValue('alllowercase');
    component.passwordForm.get('newPassword')?.markAsTouched();

    expect(component.passwordForm.get('newPassword')?.hasError('passwordComplexity')).toBe(true);

    component.passwordForm.get('newPassword')?.setValue('ValidPass1');
    expect(component.passwordForm.get('newPassword')?.hasError('passwordComplexity')).toBe(false);
  });

  it('should validate that passwords match', () => {
    component.passwordForm.get('newPassword')?.setValue('ValidPass1');
    component.passwordForm.get('confirmPassword')?.setValue('DifferentPass1');
    component.passwordForm.get('confirmPassword')?.markAsTouched();

    expect(component.passwordForm.hasError('passwordMismatch')).toBe(true);

    component.passwordForm.get('confirmPassword')?.setValue('ValidPass1');
    expect(component.passwordForm.hasError('passwordMismatch')).toBe(false);
  });

  it('should call AuthService.setPassword on valid submit', () => {
    authServiceMock['setPassword'].mockReturnValue(of(undefined));
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.passwordForm.setValue({
      newPassword: 'ValidPass1',
      confirmPassword: 'ValidPass1',
    });
    component.onSubmit();

    expect(authServiceMock['setPassword']).toHaveBeenCalledWith('valid-token-123', 'ValidPass1');
  });

  it('should redirect to /auth/login with message on success', () => {
    authServiceMock['setPassword'].mockReturnValue(of(undefined));
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    component.passwordForm.setValue({
      newPassword: 'ValidPass1',
      confirmPassword: 'ValidPass1',
    });
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { message: 'password-set' },
    });
  });

  it('should show error message on failure', () => {
    authServiceMock['setPassword'].mockReturnValue(throwError(() => new Error('Failed')));

    component.passwordForm.setValue({
      newPassword: 'ValidPass1',
      confirmPassword: 'ValidPass1',
    });
    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Failed to set password. The link may have expired.');
    expect(component.isLoading).toBe(false);
  });

  it('should toggle password visibility', () => {
    expect(component.showNewPassword).toBe(false);
    component.toggleNewPassword();
    expect(component.showNewPassword).toBe(true);

    expect(component.showConfirmPassword).toBe(false);
    component.toggleConfirmPassword();
    expect(component.showConfirmPassword).toBe(true);
  });
});
