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

describe('LoginComponent', () => {
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
                get: (_key: string) => null,
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

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should render login form with email and password fields', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('input#email')).toBeTruthy();
    expect(el.querySelector('input#password')).toBeTruthy();
    expect(el.querySelector('button[type="submit"]')).toBeTruthy();
  });

  it('should show validation errors when form is submitted empty', () => {
    component.onSubmit();
    fixture.detectChanges();

    expect(component.loginForm.get('email')?.hasError('required')).toBe(true);
    expect(component.loginForm.get('password')?.hasError('required')).toBe(true);
  });

  it('should show email format error for invalid email', () => {
    component.loginForm.get('email')?.setValue('not-an-email');
    component.loginForm.get('email')?.markAsTouched();
    fixture.detectChanges();

    expect(component.loginForm.get('email')?.hasError('email')).toBe(true);
  });

  it('should call AuthService.login on valid submit', () => {
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

  it('should redirect bubble_admin to /admin/dashboard after login', () => {
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

  it('should redirect creator to /app/workflows after login', () => {
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

  it('should redirect customer_admin to /app/workflows after login', () => {
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

  it('should redirect to returnUrl after login when present', () => {
    TestBed.resetTestingModule();

    const returnUrlMock = {
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
    };

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: returnUrlMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) =>
                  key === 'returnUrl' ? '/admin/tenants/123' : null,
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

    const f = TestBed.createComponent(LoginComponent);
    const r = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(r, 'navigateByUrl').mockResolvedValue(true);
    f.detectChanges();

    f.componentInstance.loginForm.setValue({ email: 'admin@test.com', password: 'password123' });
    f.componentInstance.onSubmit();

    expect(navigateSpy).toHaveBeenCalledWith('/admin/tenants/123');
  });

  it('should show error message on login failure', () => {
    authServiceMock['login'].mockReturnValue(throwError(() => new Error('Unauthorized')));

    component.loginForm.setValue({ email: 'admin@test.com', password: 'wrong' });
    component.onSubmit();
    fixture.detectChanges();

    expect(component.errorMessage).toBe('Invalid email or password');
    expect(component.isLoading).toBe(false);
  });

  it('should toggle password visibility', () => {
    expect(component.showPassword).toBe(false);
    component.togglePassword();
    expect(component.showPassword).toBe(true);
    component.togglePassword();
    expect(component.showPassword).toBe(false);
  });

  it('should show success message when redirected from set-password', () => {
    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            getCurrentUser: jest.fn(),
            isAuthenticated: jest.fn(),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => (key === 'message' ? 'password-set' : null),
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

    const f = TestBed.createComponent(LoginComponent);
    f.detectChanges();
    expect(f.componentInstance.successMessage).toBe(
      'Password set successfully. Please sign in.'
    );
  });
});
