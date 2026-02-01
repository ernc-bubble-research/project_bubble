import { Component } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { LUCIDE_ICONS, LucideIconProvider, Eye, EyeOff } from 'lucide-angular';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../core/services/auth.service';

@Component({ standalone: true, template: '' })
class DummyComponent {}

function createLoginFixture(overrides: {
  queryParams?: Record<string, string | null>;
  authService?: Record<string, jest.Mock>;
} = {}) {
  TestBed.resetTestingModule();

  const defaultAuthService = {
    login: jest.fn(),
    getCurrentUser: jest.fn(),
    isAuthenticated: jest.fn(),
    ...overrides.authService,
  };

  const queryParamGet = (key: string) => overrides.queryParams?.[key] ?? null;

  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideRouter([{ path: '**', component: DummyComponent }]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: defaultAuthService },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: { get: queryParamGet },
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

  return {
    fixture: TestBed.createComponent(LoginComponent),
    authService: defaultAuthService,
  };
}

describe('LoginComponent [P1]', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let authServiceMock: Record<string, jest.Mock>;
  let router: Router;

  beforeEach(async () => {
    authServiceMock = {
      login: jest.fn(),
      getCurrentUser: jest.fn(),
      isAuthenticated: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
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
                get: () => null,
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

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  it('[1H.1-UNIT-001] should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('[1H.1-UNIT-002] should render login form with email and password fields', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input#email')).toBeTruthy();
    expect(el.querySelector('input#password')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('[1H.1-UNIT-003] should show validation errors when form is submitted empty', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(component.loginForm.get('email')?.hasError('required')).toBe(true);
    expect(component.loginForm.get('password')?.hasError('required')).toBe(true);
  });

  it('[1H.1-UNIT-004] should show email format error for invalid email', () => {
    component.loginForm.get('email')?.setValue('not-an-email');
    component.loginForm.get('email')?.markAsTouched();
    fixture.detectChanges();

    expect(component.loginForm.get('email')?.hasError('email')).toBe(true);
  });

  it('[1H.1-UNIT-005] should call AuthService.login on valid submit', () => {
    authServiceMock['login'].mockReturnValue(of({ accessToken: 'fake-token' }));
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '1',
      email: 'admin@test.com',
      role: 'bubble_admin',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.loginForm.setValue({ email: 'admin@test.com', password: 'password123' });
    component.onSubmit();

    expect(authServiceMock['login']).toHaveBeenCalledWith('admin@test.com', 'password123');
  });

  it('[1H.1-UNIT-006] should redirect bubble_admin to /admin/dashboard after login', () => {
    authServiceMock['login'].mockReturnValue(of({ accessToken: 'fake-token' }));
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '1',
      email: 'admin@test.com',
      role: 'bubble_admin',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.loginForm.setValue({ email: 'admin@test.com', password: 'password123' });
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('[1H.1-UNIT-007] should redirect creator to /app/workflows after login', () => {
    authServiceMock['login'].mockReturnValue(of({ accessToken: 'fake-token' }));
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '2',
      email: 'creator@test.com',
      role: 'creator',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.loginForm.setValue({ email: 'creator@test.com', password: 'password123' });
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/app/workflows');
  });

  it('[1H.1-UNIT-008] should redirect customer_admin to /app/workflows after login', () => {
    authServiceMock['login'].mockReturnValue(of({ accessToken: 'fake-token' }));
    authServiceMock['getCurrentUser'].mockReturnValue({
      id: '3',
      email: 'ca@test.com',
      role: 'customer_admin',
      tenantId: 't1',
      createdAt: '',
      updatedAt: '',
    });
    const navigateSpy = jest.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.loginForm.setValue({ email: 'ca@test.com', password: 'password123' });
    component.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/app/workflows');
  });

  it('[1H.1-UNIT-009] should redirect to returnUrl after login when present', () => {
    const { fixture: f } = createLoginFixture({
      queryParams: { returnUrl: '/admin/tenants/123' },
      authService: {
        login: jest.fn().mockReturnValue(of({ accessToken: 'fake-token' })),
        getCurrentUser: jest.fn().mockReturnValue({
          id: '1',
          email: 'admin@test.com',
          role: 'bubble_admin',
          tenantId: 't1',
          createdAt: '',
          updatedAt: '',
        }),
        isAuthenticated: jest.fn(),
      },
    });

    const r = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(r, 'navigateByUrl').mockResolvedValue(true);
    f.detectChanges();

    f.componentInstance.loginForm.setValue({ email: 'admin@test.com', password: 'password123' });
    f.componentInstance.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/admin/tenants/123');
  });

  it('[1H.1-UNIT-010] should show error message on login failure', () => {
    authServiceMock['login'].mockReturnValue(throwError(() => new Error('Unauthorized')));

    component.loginForm.setValue({ email: 'admin@test.com', password: 'wrong' });
    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid email or password');
    expect(component.isLoading).toBe(false);
  });

  it('[1H.1-UNIT-011] should toggle password visibility', () => {
    expect(component.showPassword).toBe(false);
    component.togglePassword();
    expect(component.showPassword).toBe(true);
    component.togglePassword();
    expect(component.showPassword).toBe(false);
  });

  it('[1H.1-UNIT-012] should show success message when redirected from set-password', () => {
    const { fixture: f } = createLoginFixture({
      queryParams: { message: 'password-set' },
    });

    f.detectChanges();
    expect(f.componentInstance.successMessage).toBe(
      'Password set successfully. Please sign in.'
    );
  });
});
